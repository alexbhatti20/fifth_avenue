-- =====================================================
-- ZOIRO BROAST - Push Notifications System
-- Completely FREE using Web Push API with VAPID keys
-- No external API or paid services required
-- =====================================================

-- Drop existing objects if they exist (for clean reinstall)
DROP TABLE IF EXISTS push_notification_queue CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP FUNCTION IF EXISTS save_push_subscription CASCADE;
DROP FUNCTION IF EXISTS remove_push_subscription CASCADE;
DROP FUNCTION IF EXISTS get_push_subscriptions CASCADE;
DROP FUNCTION IF EXISTS queue_push_notification CASCADE;
DROP FUNCTION IF EXISTS get_pending_push_notifications CASCADE;
DROP FUNCTION IF EXISTS mark_push_notification_sent CASCADE;
DROP FUNCTION IF EXISTS notify_order_placed CASCADE;
DROP FUNCTION IF EXISTS notify_customer_status_change CASCADE;
DROP FUNCTION IF EXISTS notify_new_offer CASCADE;
DROP FUNCTION IF EXISTS notify_employees_by_role CASCADE;

-- =====================================================
-- PUSH SUBSCRIPTIONS TABLE
-- Stores browser push subscription data
-- =====================================================

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('employee', 'customer')),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_subscription UNIQUE (user_id, user_type, endpoint)
);

-- Indexes for fast lookups
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id, user_type) WHERE is_active = true;
CREATE INDEX idx_push_subs_type ON push_subscriptions(user_type) WHERE is_active = true;
CREATE INDEX idx_push_subs_endpoint ON push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role full access" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users read own subs" ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subs" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own subs" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users update own subs" ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- PUSH NOTIFICATION QUEUE TABLE
-- Queue for batch processing notifications
-- =====================================================

CREATE TABLE push_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_ids UUID[] DEFAULT '{}',
  target_user_type VARCHAR(20) DEFAULT 'all' CHECK (target_user_type IN ('employee', 'customer', 'all')),
  target_roles TEXT[] DEFAULT '{}',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT DEFAULT '/assets/zoiro-logo.png',
  badge TEXT DEFAULT '/assets/zoiro-badge.png',
  image TEXT,
  tag VARCHAR(100),
  notification_type VARCHAR(50) NOT NULL,
  reference_id UUID,
  data JSONB DEFAULT '{}',
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'partial')),
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_details JSONB DEFAULT '[]',
  created_by UUID
);

-- Indexes for queue processing
CREATE INDEX idx_push_queue_pending ON push_notification_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_push_queue_type ON push_notification_queue(notification_type);

-- Enable RLS
ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access queue" ON push_notification_queue FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- RPC: SAVE PUSH SUBSCRIPTION (Authenticated)
-- Called when user enables push notifications
-- =====================================================

CREATE OR REPLACE FUNCTION save_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_user_type VARCHAR DEFAULT 'employee',
  p_device_info JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_sub_id UUID;
BEGIN
  -- Get user ID from parameter or auth.uid()
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Validate inputs
  IF p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription data');
  END IF;

  -- Upsert subscription
  INSERT INTO push_subscriptions (
    user_id, user_type, endpoint, p256dh, auth, device_info, updated_at
  ) VALUES (
    v_user_id, p_user_type, p_endpoint, p_p256dh, p_auth, p_device_info, NOW()
  )
  ON CONFLICT (user_id, user_type, endpoint) 
  DO UPDATE SET
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    device_info = EXCLUDED.device_info,
    is_active = true,
    updated_at = NOW(),
    last_used_at = NOW()
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'message', 'Push subscription saved'
  );
END;
$$;

-- =====================================================
-- RPC: REMOVE PUSH SUBSCRIPTION (Authenticated)
-- Called when user disables push notifications
-- =====================================================

CREATE OR REPLACE FUNCTION remove_push_subscription(
  p_endpoint TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_deleted INT;
BEGIN
  -- Get user ID from parameter or auth.uid()
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_endpoint IS NOT NULL THEN
    -- Delete specific subscription
    DELETE FROM push_subscriptions 
    WHERE user_id = v_user_id AND endpoint = p_endpoint;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSE
    -- Delete all subscriptions for user
    DELETE FROM push_subscriptions WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted
  );
END;
$$;

-- =====================================================
-- RPC: GET PUSH SUBSCRIPTIONS (For sending - Service Role)
-- Returns subscriptions for target audience
-- =====================================================

CREATE OR REPLACE FUNCTION get_push_subscriptions(
  p_user_ids UUID[] DEFAULT NULL,
  p_user_type VARCHAR DEFAULT 'all',
  p_roles TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  subscription_id UUID,
  user_id UUID,
  user_type VARCHAR,
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.user_id,
    ps.user_type,
    ps.endpoint,
    ps.p256dh,
    ps.auth
  FROM push_subscriptions ps
  LEFT JOIN employees e ON ps.user_type = 'employee' AND ps.user_id = e.id
  WHERE ps.is_active = true
    AND (p_user_ids IS NULL OR ps.user_id = ANY(p_user_ids))
    AND (p_user_type = 'all' OR ps.user_type = p_user_type)
    AND (p_roles IS NULL OR e.role = ANY(p_roles));
END;
$$;

-- =====================================================
-- RPC: QUEUE PUSH NOTIFICATION (Authenticated Admin/System)
-- Queues notification for batch processing
-- =====================================================

CREATE OR REPLACE FUNCTION queue_push_notification(
  p_title TEXT,
  p_body TEXT,
  p_notification_type VARCHAR,
  p_user_ids UUID[] DEFAULT NULL,
  p_user_type VARCHAR DEFAULT 'all',
  p_target_roles TEXT[] DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_data JSONB DEFAULT '{}',
  p_image TEXT DEFAULT NULL,
  p_priority VARCHAR DEFAULT 'normal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_queue_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if user is admin (for manual notifications)
  -- System triggers can bypass with SECURITY DEFINER
  IF v_user_id IS NOT NULL THEN
    SELECT role IN ('admin', 'manager') INTO v_is_admin
    FROM employees WHERE id = v_user_id;
    
    IF NOT COALESCE(v_is_admin, false) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
    END IF;
  END IF;

  -- Insert into queue
  INSERT INTO push_notification_queue (
    target_user_ids,
    target_user_type,
    target_roles,
    title,
    body,
    notification_type,
    reference_id,
    data,
    image,
    priority,
    created_by
  ) VALUES (
    COALESCE(p_user_ids, '{}'),
    p_user_type,
    COALESCE(p_target_roles, '{}'),
    p_title,
    p_body,
    p_notification_type,
    p_reference_id,
    p_data,
    p_image,
    p_priority,
    v_user_id
  )
  RETURNING id INTO v_queue_id;

  -- Also create in-app notification
  IF p_user_ids IS NOT NULL AND array_length(p_user_ids, 1) > 0 THEN
    INSERT INTO notifications (user_id, user_type, title, message, type, reference_id, data)
    SELECT 
      uid,
      p_user_type,
      p_title,
      p_body,
      p_notification_type,
      p_reference_id,
      p_data
    FROM unnest(p_user_ids) AS uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'queue_id', v_queue_id,
    'message', 'Notification queued'
  );
END;
$$;

-- =====================================================
-- RPC: GET PENDING PUSH NOTIFICATIONS (For Worker)
-- Returns notifications to be sent
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_push_notifications(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  queue_id UUID,
  target_user_ids UUID[],
  target_user_type VARCHAR,
  target_roles TEXT[],
  title TEXT,
  body TEXT,
  icon TEXT,
  badge TEXT,
  image TEXT,
  tag VARCHAR,
  notification_type VARCHAR,
  reference_id UUID,
  data JSONB,
  priority VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark as processing
  UPDATE push_notification_queue
  SET status = 'processing'
  WHERE id IN (
    SELECT id FROM push_notification_queue
    WHERE status = 'pending'
    ORDER BY 
      CASE priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        ELSE 4 
      END,
      created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  );

  RETURN QUERY
  SELECT 
    pnq.id,
    pnq.target_user_ids,
    pnq.target_user_type,
    pnq.target_roles,
    pnq.title,
    pnq.body,
    pnq.icon,
    pnq.badge,
    pnq.image,
    pnq.tag,
    pnq.notification_type,
    pnq.reference_id,
    pnq.data,
    pnq.priority
  FROM push_notification_queue pnq
  WHERE pnq.status = 'processing'
  ORDER BY 
    CASE pnq.priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      ELSE 4 
    END,
    pnq.created_at
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- RPC: MARK PUSH NOTIFICATION SENT
-- Updates queue status after sending
-- =====================================================

CREATE OR REPLACE FUNCTION mark_push_notification_sent(
  p_queue_id UUID,
  p_sent_count INT DEFAULT 0,
  p_failed_count INT DEFAULT 0,
  p_error_details JSONB DEFAULT '[]'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE push_notification_queue
  SET 
    status = CASE 
      WHEN p_failed_count = 0 THEN 'sent'
      WHEN p_sent_count = 0 THEN 'failed'
      ELSE 'partial'
    END,
    sent_count = p_sent_count,
    failed_count = p_failed_count,
    processed_at = NOW(),
    error_details = p_error_details
  WHERE id = p_queue_id;
  
  RETURN FOUND;
END;
$$;

-- =====================================================
-- HELPER: NOTIFY ORDER PLACED (for triggers)
-- Notifies customer + employees about new order
-- =====================================================

CREATE OR REPLACE FUNCTION notify_order_placed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify customer about order confirmation
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO push_notification_queue (
      target_user_ids, target_user_type, title, body, notification_type, reference_id, data
    ) VALUES (
      ARRAY[NEW.customer_id],
      'customer',
      '🎉 Order Confirmed!',
      'Your order #' || NEW.order_number || ' has been received. We''re preparing your delicious meal!',
      'order_confirmed',
      NEW.id,
      jsonb_build_object('order_number', NEW.order_number, 'total', NEW.total_amount)
    );
  END IF;

  -- Notify kitchen staff about new order
  INSERT INTO push_notification_queue (
    target_user_type, target_roles, title, body, notification_type, reference_id, priority
  ) VALUES (
    'employee',
    ARRAY['admin', 'manager', 'kitchen', 'cashier'],
    '🔔 New Order #' || NEW.order_number,
    'New ' || NEW.order_type || ' order placed',
    'new_order',
    NEW.id,
    'high'
  );

  RETURN NEW;
END;
$$;

-- =====================================================
-- HELPER: NOTIFY CUSTOMER STATUS CHANGE
-- For ban/unban notifications
-- =====================================================

CREATE OR REPLACE FUNCTION notify_customer_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Customer was banned
  IF NEW.is_banned = true AND (OLD.is_banned IS NULL OR OLD.is_banned = false) THEN
    -- Notify admins
    INSERT INTO push_notification_queue (
      target_user_type, target_roles, title, body, notification_type, reference_id
    ) VALUES (
      'employee',
      ARRAY['admin', 'manager'],
      '⚠️ Customer Banned',
      'Customer ' || NEW.name || ' has been banned',
      'customer_ban',
      NEW.id
    );
  END IF;

  -- Customer was unbanned
  IF NEW.is_banned = false AND OLD.is_banned = true THEN
    -- Notify admins
    INSERT INTO push_notification_queue (
      target_user_type, target_roles, title, body, notification_type, reference_id
    ) VALUES (
      'employee',
      ARRAY['admin', 'manager'],
      '✅ Customer Unbanned',
      'Customer ' || NEW.name || ' has been unbanned',
      'customer_unban',
      NEW.id
    );
    
    -- Notify customer
    INSERT INTO push_notification_queue (
      target_user_ids, target_user_type, title, body, notification_type
    ) VALUES (
      ARRAY[NEW.id],
      'customer',
      '🎉 Welcome Back!',
      'Your account has been reactivated. We''re happy to serve you again!',
      'account_reactivated'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- HELPER: NOTIFY NEW OFFER
-- Broadcasts promotional offers to customers
-- =====================================================

CREATE OR REPLACE FUNCTION notify_new_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only notify for active promo codes
  IF NEW.is_active = true THEN
    INSERT INTO push_notification_queue (
      target_user_type, title, body, notification_type, reference_id, image, data
    ) VALUES (
      'customer',
      '🎁 Special Offer from Zoiro!',
      COALESCE(NEW.description, 'Use code ' || NEW.code || ' for ' || NEW.discount_value || 
        CASE WHEN NEW.discount_type = 'percentage' THEN '%' ELSE ' Rs' END || ' off!'),
      'new_offer',
      NEW.id,
      '/assets/promo-banner.png',
      jsonb_build_object('code', NEW.code, 'discount', NEW.discount_value, 'type', NEW.discount_type)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- RPC: SEND BROADCAST NOTIFICATION (Admin Only)
-- For sending custom notifications to all users
-- =====================================================

CREATE OR REPLACE FUNCTION send_broadcast_notification(
  p_title TEXT,
  p_body TEXT,
  p_target_audience VARCHAR DEFAULT 'all',
  p_image TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_queue_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT role = 'admin' INTO v_is_admin FROM employees WHERE id = v_user_id;
  
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  INSERT INTO push_notification_queue (
    target_user_type, title, body, notification_type, image, priority, created_by
  ) VALUES (
    p_target_audience,
    p_title,
    p_body,
    'broadcast',
    p_image,
    'normal',
    v_user_id
  )
  RETURNING id INTO v_queue_id;

  RETURN jsonb_build_object(
    'success', true,
    'queue_id', v_queue_id,
    'message', 'Broadcast notification queued'
  );
END;
$$;

-- =====================================================
-- DROP EXISTING TRIGGERS (safe re-run)
-- =====================================================

DROP TRIGGER IF EXISTS on_order_placed ON orders;
DROP TRIGGER IF EXISTS on_customer_status_change ON customers;
DROP TRIGGER IF EXISTS on_new_promo ON promo_codes;

-- =====================================================
-- TRIGGERS (Auto-notifications)
-- =====================================================

-- Trigger for new orders (notifies kitchen + customer)
CREATE TRIGGER on_order_placed
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_placed();

-- Trigger for customer ban/unban
CREATE TRIGGER on_customer_status_change
  AFTER UPDATE OF is_banned ON customers
  FOR EACH ROW
  WHEN (OLD.is_banned IS DISTINCT FROM NEW.is_banned)
  EXECUTE FUNCTION notify_customer_status_change();

-- Trigger for new promo codes (notifies all customers)
CREATE TRIGGER on_new_promo
  AFTER INSERT ON promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_offer();

-- =====================================================
-- GRANTS
-- =====================================================

-- =====================================================
-- RPC: GET CUSTOMERS FOR NOTIFICATIONS
-- Returns customers eligible for notifications (bypasses RLS)
-- =====================================================

CREATE OR REPLACE FUNCTION get_customers_for_notifications(
  p_notification_type VARCHAR DEFAULT 'email'
)
RETURNS TABLE (
  customer_id UUID,
  email TEXT,
  name TEXT,
  phone TEXT,
  notification_preferences JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.email,
    c.name,
    c.phone,
    c.notification_preferences
  FROM customers c
  WHERE c.is_banned = false
    AND c.email IS NOT NULL
    AND (
      p_notification_type = 'email' AND 
      (c.notification_preferences->>'email_notifications')::boolean IS NOT false
    )
  ORDER BY c.created_at DESC;
END;
$$;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON push_subscriptions TO authenticated;
GRANT ALL ON push_subscriptions TO service_role;
GRANT ALL ON push_notification_queue TO authenticated;
GRANT ALL ON push_notification_queue TO service_role;

GRANT EXECUTE ON FUNCTION save_push_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION remove_push_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION get_push_subscriptions TO service_role;
GRANT EXECUTE ON FUNCTION get_customers_for_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION queue_push_notification TO authenticated;
GRANT EXECUTE ON FUNCTION queue_push_notification TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_push_notifications TO service_role;
GRANT EXECUTE ON FUNCTION mark_push_notification_sent TO service_role;
GRANT EXECUTE ON FUNCTION send_broadcast_notification TO authenticated;

-- =====================================================
-- 🎉 DONE! 100% FREE with VAPID keys - No paid API needed
-- =====================================================
-- Requirements:
-- 1. npm install web-push
-- 2. npx web-push generate-vapid-keys
-- 3. Add to .env:
--    NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
--    VAPID_PRIVATE_KEY=...
-- 4. Run this SQL in Supabase
-- =====================================================
