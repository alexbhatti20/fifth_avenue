--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--




--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendance_status AS ENUM (
    'present',
    'absent',
    'late',
    'half_day',
    'on_leave'
);


--
-- Name: employee_complete; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_complete AS (
	id uuid,
	employee_id text,
	auth_user_id uuid,
	name text,
	email text,
	phone text,
	role text,
	status text,
	avatar_url text,
	address text,
	emergency_contact text,
	emergency_contact_name text,
	date_of_birth date,
	blood_group text,
	hired_date date,
	portal_enabled boolean,
	permissions jsonb,
	notes text,
	license_id text,
	license_activated boolean,
	license_expires timestamp with time zone,
	salary numeric,
	bank_details jsonb,
	total_tips numeric,
	total_orders_taken integer,
	documents jsonb,
	last_login timestamp with time zone,
	attendance_this_month integer,
	total_attendance integer,
	created_at timestamp with time zone,
	updated_at timestamp with time zone
);


--
-- Name: employee_list_item; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_list_item AS (
	id uuid,
	employee_id text,
	license_id text,
	name text,
	email text,
	phone text,
	role text,
	status text,
	avatar_url text,
	portal_enabled boolean,
	hired_date date,
	salary numeric,
	total_tips numeric,
	total_orders_taken integer,
	last_login timestamp with time zone,
	created_at timestamp with time zone,
	attendance_this_month integer,
	documents_count integer
);


--
-- Name: employee_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_role AS ENUM (
    'admin',
    'manager',
    'waiter',
    'billing_staff',
    'kitchen_staff',
    'delivery_rider',
    'other'
);


--
-- Name: employee_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_status AS ENUM (
    'active',
    'inactive',
    'blocked',
    'pending'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'pending',
    'paid',
    'cancelled',
    'refunded'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'order',
    'system',
    'alert',
    'promo',
    'message',
    'attendance'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'delivering',
    'delivered',
    'cancelled'
);


--
-- Name: order_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_type AS ENUM (
    'online',
    'walk-in',
    'dine-in'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'card',
    'online',
    'wallet'
);


--
-- Name: promo_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.promo_type AS ENUM (
    'percentage',
    'fixed_amount',
    'free_item',
    'loyalty_points'
);


--
-- Name: table_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_status AS ENUM (
    'available',
    'occupied',
    'reserved',
    'cleaning',
    'out_of_service'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'manager',
    'cashier',
    'reception',
    'kitchen',
    'waiter',
    'billing_staff',
    'kitchen_staff',
    'delivery_rider',
    'other'
);


--
-- Name: accept_delivery_order(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_delivery_order(p_order_id uuid, p_rider_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_rider RECORD;
BEGIN
    -- Determine rider ID
    v_rider_id := COALESCE(p_rider_id, get_employee_id());
    
    IF v_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Validate rider
    SELECT id, name, phone INTO v_rider
    FROM employees
    WHERE id = v_rider_id
      AND role = 'delivery_rider'
      AND status = 'active';
    
    IF v_rider.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not a valid delivery rider');
    END IF;
    
    -- Get and lock order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.status != 'ready' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is not ready for delivery');
    END IF;
    
    IF v_order.delivery_rider_id IS NOT NULL AND v_order.delivery_rider_id != v_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order already assigned to another rider');
    END IF;
    
    -- Update order
    UPDATE orders
    SET 
        delivery_rider_id = v_rider_id,
        status = 'delivering'::order_status,
        delivery_started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Create delivery history record
    PERFORM create_delivery_history_record(v_rider_id, p_order_id);
    
    -- Update to delivering status
    UPDATE delivery_history
    SET delivery_status = 'delivering',
        started_at = NOW(),
        updated_at = NOW()
    WHERE rider_id = v_rider_id AND order_id = p_order_id;
    
    -- Log status change
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, 'delivering', 'Accepted by rider: ' || v_rider.name, v_rider_id, NOW());
    
    RETURN jsonb_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'order', jsonb_build_object(
            'id', v_order.id,
            'order_number', v_order.order_number,
            'customer_name', v_order.customer_name,
            'customer_phone', v_order.customer_phone,
            'customer_address', v_order.customer_address,
            'total', v_order.total,
            'payment_method', v_order.payment_method
        ),
        'rider', jsonb_build_object(
            'id', v_rider.id,
            'name', v_rider.name,
            'phone', v_rider.phone
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: FUNCTION accept_delivery_order(p_order_id uuid, p_rider_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.accept_delivery_order(p_order_id uuid, p_rider_id uuid) IS 'Rider self-accepts an available order (creates history)';


--
-- Name: activate_customer_promo_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_customer_promo_admin(p_promo_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE promo_codes
    SET is_active = true, updated_at = NOW()
    WHERE id = p_promo_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Promo code activated');
END;
$$;


--
-- Name: activate_employee(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_employee(emp_id uuid, user_auth_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE employees
    SET 
        auth_user_id = user_auth_id,
        is_verified = true,
        status = 'active',
        updated_at = NOW()
    WHERE id = emp_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$;


--
-- Name: activate_employee(uuid, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_employee(p_employee_id uuid, p_enable_portal boolean DEFAULT true, p_activated_by uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_employee_name TEXT;
  v_old_status TEXT;
  v_new_license_id TEXT;
BEGIN
  SELECT name, status::TEXT INTO v_employee_name, v_old_status
  FROM employees WHERE id = p_employee_id;

  IF v_employee_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Update employee status
  UPDATE employees SET
    status = 'active'::employee_status,
    portal_enabled = p_enable_portal,
    updated_at = NOW()
  WHERE id = p_employee_id;

  -- Generate new license if needed
  IF p_enable_portal THEN
    v_new_license_id := 'LIC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
                        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 5 FOR 4)) || '-' ||
                        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 9 FOR 4));
    
    -- Expire old licenses
    UPDATE employee_licenses SET expires_at = NOW() WHERE employee_id = p_employee_id;
    
    -- Create new license
    INSERT INTO employee_licenses (employee_id, license_id, is_used, expires_at)
    VALUES (p_employee_id, v_new_license_id, false, NOW() + INTERVAL '30 days');
    
    -- Update employee license_id
    UPDATE employees SET license_id = v_new_license_id WHERE id = p_employee_id;
  END IF;

  -- Log in audit
  INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id)
  VALUES (
    'activate_employee', 
    'employees', 
    p_employee_id, 
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'active', 'portal_enabled', p_enable_portal),
    p_activated_by
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Employee "' || v_employee_name || '" has been activated',
    'previous_status', v_old_status,
    'portal_enabled', p_enable_portal,
    'new_license_id', v_new_license_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: activate_employee_account(character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_employee_account(p_license_id character varying, p_auth_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    result JSON;
BEGIN
    -- Find employee by license
    SELECT el.employee_id INTO emp_id
    FROM employee_licenses el
    WHERE el.license_id = p_license_id
    AND el.is_used = false
    AND el.expires_at > NOW();
    
    IF emp_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid or expired license ID'
        );
    END IF;
    
    -- Update employee
    UPDATE employees
    SET auth_user_id = p_auth_user_id,
        status = 'active',
        portal_enabled = true,
        updated_at = NOW()
    WHERE id = emp_id;
    
    -- Mark license as used
    UPDATE employee_licenses
    SET is_used = true,
        activated_at = NOW()
    WHERE license_id = p_license_id;
    
    RETURN json_build_object(
        'success', true,
        'employee_id', emp_id
    );
END;
$$;


--
-- Name: activate_employee_portal(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_employee_portal(p_email text, p_auth_user_id uuid, p_license_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_employee RECORD;
    v_license_updated BOOLEAN := FALSE;
BEGIN
    -- Normalize email
    p_email := LOWER(TRIM(p_email));
    
    -- Find and update employee
    UPDATE employees
    SET 
        auth_user_id = p_auth_user_id,
        status = 'active',
        portal_enabled = TRUE,
        updated_at = NOW()
    WHERE LOWER(email) = p_email
    RETURNING id, name, email, role, employee_id, permissions
    INTO v_employee;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Employee not found'
        );
    END IF;
    
    -- Mark license as used (if license_id provided)
    IF p_license_id IS NOT NULL AND p_license_id != '' THEN
        UPDATE employee_licenses
        SET 
            is_used = TRUE,
            activated_at = NOW()
        WHERE employee_id = v_employee.id
          AND license_id = UPPER(TRIM(p_license_id));
        
        v_license_updated := FOUND;
    ELSE
        -- Try to mark any unused license for this employee (using subquery since LIMIT not allowed in UPDATE)
        UPDATE employee_licenses
        SET 
            is_used = TRUE,
            activated_at = NOW()
        WHERE id = (
            SELECT id FROM employee_licenses
            WHERE employee_id = v_employee.id
              AND is_used = FALSE
              AND expires_at > NOW()
            ORDER BY expires_at ASC
            LIMIT 1
        );
        
        v_license_updated := FOUND;
    END IF;
    
    -- Return success with employee data
    RETURN jsonb_build_object(
        'success', TRUE,
        'employee', jsonb_build_object(
            'id', v_employee.id,
            'name', v_employee.name,
            'email', v_employee.email,
            'role', v_employee.role::TEXT,
            'employee_id', v_employee.employee_id,
            'permissions', v_employee.permissions
        ),
        'license_updated', v_license_updated
    );
END;
$$;


--
-- Name: add_contact_message_reply(uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_contact_message_reply(p_message_id uuid, p_reply_message text, p_replied_by uuid, p_send_via text DEFAULT 'email'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: add_employee_document(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_employee_document(p_employee_id uuid, p_document_type text, p_document_name text, p_file_url text, p_file_type text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_doc_id UUID;
BEGIN
  -- Verify employee exists
  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  INSERT INTO employee_documents (
    employee_id,
    document_type,
    document_name,
    file_url,
    file_type
  ) VALUES (
    p_employee_id,
    p_document_type,
    p_document_name,
    p_file_url,
    p_file_type
  ) RETURNING id INTO v_doc_id;

  RETURN jsonb_build_object(
    'success', true,
    'document_id', v_doc_id,
    'message', 'Document added successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: add_employee_document_v2(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_employee_document_v2(p_employee_id uuid, p_document_type text, p_document_name text, p_file_url text, p_file_type text DEFAULT 'unknown'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_doc_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Employee not found');
    END IF;

    INSERT INTO employee_documents (employee_id, document_type, document_name, file_url, file_type, uploaded_at, verified)
    VALUES (p_employee_id, p_document_type, p_document_name, p_file_url, p_file_type, NOW(), FALSE)
    RETURNING id INTO v_doc_id;

    RETURN jsonb_build_object('success', TRUE, 'document_id', v_doc_id, 'message', 'Document added successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;


--
-- Name: add_items_to_order(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_items_to_order(p_order_id uuid, p_new_items jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_waiter_id UUID;
    v_order_record RECORD;
    v_updated_items JSONB;
    v_new_subtotal DECIMAL(10, 2);
    v_new_tax DECIMAL(10, 2);
    v_new_total DECIMAL(10, 2);
    v_new_items_count INT;
BEGIN
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get order
    SELECT * INTO v_order_record FROM orders 
    WHERE id = p_order_id FOR UPDATE;
    
    IF v_order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Validate waiter owns this order
    IF v_order_record.waiter_id != v_waiter_id THEN
        IF NOT EXISTS (SELECT 1 FROM employees WHERE id = v_waiter_id AND role IN ('admin', 'manager')) THEN
            RETURN json_build_object('success', false, 'error', 'Not authorized to modify this order');
        END IF;
    END IF;
    
    -- Validate order status
    IF v_order_record.status NOT IN ('pending', 'confirmed', 'preparing') THEN
        RETURN json_build_object('success', false, 'error', 'Cannot add items to this order. Status: ' || v_order_record.status);
    END IF;
    
    -- Merge items
    v_updated_items := v_order_record.items || p_new_items;
    
    -- Recalculate totals
    SELECT 
        COALESCE(SUM((item->>'price')::DECIMAL * (item->>'quantity')::INT), 0),
        COALESCE(SUM((item->>'quantity')::INT), 0)
    INTO v_new_subtotal, v_new_items_count
    FROM jsonb_array_elements(v_updated_items) AS item;
    
    v_new_tax := ROUND(v_new_subtotal * 0.05, 2);
    v_new_total := v_new_subtotal + v_new_tax;
    
    -- Update order
    UPDATE orders
    SET 
        items = v_updated_items,
        subtotal = v_new_subtotal,
        tax = v_new_tax,
        total = v_new_total,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Update waiter history
    UPDATE waiter_order_history
    SET 
        items = v_updated_items,
        total_items = v_new_items_count,
        subtotal = v_new_subtotal,
        tax = v_new_tax,
        total = v_new_total,
        updated_at = NOW()
    WHERE order_id = p_order_id AND waiter_id = v_waiter_id;
    
    RETURN json_build_object(
        'success', true,
        'order_id', p_order_id,
        'items_count', v_new_items_count,
        'subtotal', v_new_subtotal,
        'tax', v_new_tax,
        'total', v_new_total,
        'message', 'Items added successfully'
    );
END;
$$;


--
-- Name: FUNCTION add_items_to_order(p_order_id uuid, p_new_items jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_items_to_order(p_order_id uuid, p_new_items jsonb) IS 'Adds items to existing order';


--
-- Name: add_order_loyalty_points(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_order_loyalty_points(p_customer_id uuid, p_order_id uuid, p_order_total numeric) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_points INT;
BEGIN
    -- 1 point per 100 PKR spent
    v_points := FLOOR(p_order_total / 100);
    
    IF v_points > 0 THEN
        INSERT INTO loyalty_points (customer_id, order_id, points, type, description)
        VALUES (p_customer_id, p_order_id, v_points, 'earned', 
                'Points earned from order');
    END IF;
    
    RETURN v_points;
END;
$$;


--
-- Name: add_order_review(uuid, uuid, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_order_review(p_order_id uuid, p_customer_id uuid, p_rating integer, p_comment text, p_images jsonb DEFAULT '[]'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_review_id UUID;
BEGIN
    -- Insert review
    INSERT INTO reviews (order_id, customer_id, rating, comment, images)
    VALUES (p_order_id, p_customer_id, p_rating, p_comment, p_images)
    RETURNING id INTO v_review_id;
    
    -- Create notification for admin
    INSERT INTO notifications (user_type, user_id, title, message, type)
    SELECT 'employee', e.id, 'New Review', 'A customer left a new review', 'review'
    FROM employees e
    WHERE e.role = 'admin' AND e.is_verified = true;
    
    RETURN v_review_id;
END;
$$;


--
-- Name: adjust_inventory_stock(uuid, text, numeric, text, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adjust_inventory_stock(p_item_id uuid, p_transaction_type text, p_quantity numeric, p_reason text DEFAULT NULL::text, p_unit_cost numeric DEFAULT NULL::numeric, p_reference_number text DEFAULT NULL::text, p_batch_number text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    item_record RECORD;
    new_quantity DECIMAL(10,2);
    actual_cost DECIMAL(10,2);
    qty_change DECIMAL(10,2);
BEGIN
    emp_id := get_employee_id();
    
    -- Get current item
    SELECT * INTO item_record FROM inventory WHERE id = p_item_id;
    
    IF item_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Item not found');
    END IF;
    
    -- Calculate new quantity and quantity change based on transaction type
    CASE p_transaction_type
        WHEN 'purchase' THEN 
            new_quantity := COALESCE(item_record.quantity, 0) + p_quantity;
            qty_change := p_quantity;
        WHEN 'usage' THEN 
            new_quantity := COALESCE(item_record.quantity, 0) - p_quantity;
            qty_change := -p_quantity;
        WHEN 'waste' THEN 
            new_quantity := COALESCE(item_record.quantity, 0) - p_quantity;
            qty_change := -p_quantity;
        WHEN 'return' THEN 
            new_quantity := COALESCE(item_record.quantity, 0) + p_quantity;
            qty_change := p_quantity;
        WHEN 'transfer_in' THEN 
            new_quantity := COALESCE(item_record.quantity, 0) + p_quantity;
            qty_change := p_quantity;
        WHEN 'transfer_out' THEN 
            new_quantity := COALESCE(item_record.quantity, 0) - p_quantity;
            qty_change := -p_quantity;
        WHEN 'adjustment' THEN 
            qty_change := p_quantity - COALESCE(item_record.quantity, 0);
            new_quantity := p_quantity; -- Direct set
        WHEN 'count' THEN 
            qty_change := p_quantity - COALESCE(item_record.quantity, 0);
            new_quantity := p_quantity; -- Physical count adjustment
        ELSE 
            RETURN json_build_object('success', false, 'error', 'Invalid transaction type');
    END CASE;
    
    -- Prevent negative stock (except for adjustments)
    IF new_quantity < 0 AND p_transaction_type NOT IN ('adjustment', 'count') THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient stock. Current: ' || COALESCE(item_record.quantity, 0));
    END IF;
    
    actual_cost := COALESCE(p_unit_cost, item_record.cost_per_unit, 0);
    
    -- Update inventory
    UPDATE inventory SET
        quantity = new_quantity,
        last_restocked = CASE WHEN p_transaction_type IN ('purchase', 'return', 'transfer_in') THEN NOW() ELSE last_restocked END,
        updated_at = NOW()
    WHERE id = p_item_id;
    
    -- Log transaction (insert into both type and transaction_type for backwards compatibility)
    INSERT INTO inventory_transactions (
        inventory_id, type, transaction_type, quantity, quantity_change,
        previous_quantity, new_quantity,
        unit_cost, total_cost, notes, reason, created_by, performed_by,
        reference_number, batch_number, created_at
    ) VALUES (
        p_item_id,
        p_transaction_type,
        p_transaction_type,
        ABS(qty_change),
        qty_change,
        COALESCE(item_record.quantity, 0),
        new_quantity,
        actual_cost,
        ABS(qty_change) * actual_cost,
        p_reason,
        p_reason,
        emp_id,
        emp_id,
        p_reference_number,
        p_batch_number,
        NOW()
    );
    
    -- Create alert if stock is low or out
    IF new_quantity <= 0 THEN
        INSERT INTO inventory_alerts (inventory_id, alert_type, message, created_at)
        VALUES (p_item_id, 'out_of_stock', item_record.name || ' is now out of stock', NOW())
        ON CONFLICT DO NOTHING;
    ELSIF new_quantity <= COALESCE(item_record.min_quantity, 10) THEN
        INSERT INTO inventory_alerts (inventory_id, alert_type, message, created_at)
        VALUES (p_item_id, 'low_stock', item_record.name || ' is running low (' || new_quantity || ' ' || item_record.unit || ' remaining)', NOW())
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN json_build_object(
        'success', true, 
        'new_quantity', new_quantity,
        'previous_quantity', COALESCE(item_record.quantity, 0),
        'change', qty_change
    );
END;
$$;


--
-- Name: admin_mark_attendance(uuid, date, timestamp with time zone, timestamp with time zone, character varying, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_mark_attendance(p_employee_id uuid, p_date date, p_check_in timestamp with time zone, p_check_out timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status character varying DEFAULT 'present'::character varying, p_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result RECORD;
BEGIN
    -- Only admin can manually mark attendance
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Validate employee exists
    IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id) THEN
        RETURN json_build_object('success', false, 'error', 'Employee not found');
    END IF;
    
    -- Insert or update attendance
    INSERT INTO attendance (
        employee_id,
        date,
        check_in,
        check_out,
        status,
        notes,
        created_at,
        updated_at
    )
    VALUES (
        p_employee_id,
        p_date,
        p_check_in,
        p_check_out,
        p_status,
        p_notes,
        NOW(),
        NOW()
    )
    ON CONFLICT (employee_id, date) 
    DO UPDATE SET
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    RETURNING * INTO result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Attendance recorded successfully',
        'attendance', row_to_json(result)
    );
END;
$$;


--
-- Name: FUNCTION admin_mark_attendance(p_employee_id uuid, p_date date, p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_status character varying, p_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_mark_attendance(p_employee_id uuid, p_date date, p_check_in timestamp with time zone, p_check_out timestamp with time zone, p_status character varying, p_notes text) IS 'Manually mark/correct attendance - admin only';


--
-- Name: apply_promo_code(text, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_promo_code(p_code text, p_customer_id uuid, p_order_amount numeric) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_promo RECORD;
    v_discount DECIMAL := 0;
    v_new_usage INT;
    v_is_exhausted BOOLEAN := false;
BEGIN
    -- Find the promo code with row lock for atomic update
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code)
    FOR UPDATE;  -- Lock the row to prevent race conditions

    -- Check if code exists
    IF v_promo IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid promo code',
            'error_code', 'NOT_FOUND'
        );
    END IF;

    -- Check if code is active
    IF NOT v_promo.is_active THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code is no longer active',
            'error_code', 'INACTIVE'
        );
    END IF;

    -- Check customer-specific codes belong to the right customer
    IF v_promo.customer_id IS NOT NULL AND v_promo.customer_id != p_customer_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code is not available for your account',
            'error_code', 'WRONG_CUSTOMER'
        );
    END IF;

    -- Check validity dates
    IF v_promo.valid_from IS NOT NULL AND v_promo.valid_from > NOW() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code is not yet active. Valid from: ' || TO_CHAR(v_promo.valid_from, 'DD Mon YYYY'),
            'error_code', 'NOT_YET_VALID'
        );
    END IF;

    IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < NOW() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code has expired on ' || TO_CHAR(v_promo.valid_until, 'DD Mon YYYY'),
            'error_code', 'EXPIRED'
        );
    END IF;

    -- Check usage limit
    IF v_promo.usage_limit IS NOT NULL AND v_promo.current_usage >= v_promo.usage_limit THEN
        RETURN json_build_object(
            'success', false,
            'error', 'This promo code has already been fully used',
            'error_code', 'USAGE_EXHAUSTED'
        );
    END IF;

    -- Check minimum order amount
    IF v_promo.min_order_amount IS NOT NULL AND p_order_amount < v_promo.min_order_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Minimum order amount of Rs. ' || v_promo.min_order_amount || ' required for this code',
            'error_code', 'MIN_ORDER_NOT_MET',
            'min_order_amount', v_promo.min_order_amount
        );
    END IF;

    -- Calculate discount based on promo type
    IF v_promo.promo_type = 'percentage' THEN
        v_discount := ROUND((p_order_amount * v_promo.value / 100)::DECIMAL, 2);
        -- Apply max discount cap if set
        IF v_promo.max_discount IS NOT NULL AND v_discount > v_promo.max_discount THEN
            v_discount := v_promo.max_discount;
        END IF;
    ELSIF v_promo.promo_type = 'fixed' THEN
        v_discount := v_promo.value;
        -- Don't let discount exceed order amount
        IF v_discount > p_order_amount THEN
            v_discount := p_order_amount;
        END IF;
    ELSIF v_promo.promo_type = 'free_item' THEN
        -- Free item promos have a fixed value representing the item price
        v_discount := COALESCE(v_promo.value, 0);
    ELSE
        -- Unknown promo type, use value as fixed discount
        v_discount := COALESCE(v_promo.value, 0);
    END IF;

    -- Increment usage count
    v_new_usage := COALESCE(v_promo.current_usage, 0) + 1;
    
    -- Check if this usage exhausts the limit
    IF v_promo.usage_limit IS NOT NULL AND v_new_usage >= v_promo.usage_limit THEN
        v_is_exhausted := true;
    END IF;

    -- Update the promo code: increment usage and potentially deactivate
    UPDATE promo_codes
    SET 
        current_usage = v_new_usage,
        is_active = CASE WHEN v_is_exhausted THEN false ELSE is_active END,
        updated_at = NOW()
    WHERE id = v_promo.id;

    -- Return success with all details
    RETURN json_build_object(
        'success', true,
        'promo', json_build_object(
            'id', v_promo.id,
            'code', v_promo.code,
            'name', v_promo.name,
            'description', v_promo.description,
            'promo_type', v_promo.promo_type::TEXT,
            'value', v_promo.value,
            'max_discount', v_promo.max_discount,
            'is_customer_reward', v_promo.customer_id IS NOT NULL
        ),
        'discount_amount', v_discount,
        'original_amount', p_order_amount,
        'final_amount', GREATEST(0, p_order_amount - v_discount),
        'usage_exhausted', v_is_exhausted,
        'message', CASE 
            WHEN v_promo.promo_type = 'percentage' THEN v_promo.value || '% discount applied!'
            WHEN v_promo.promo_type = 'fixed' THEN 'Rs. ' || v_discount || ' discount applied!'
            ELSE 'Promo code applied successfully!'
        END
    );
END;
$$;


--
-- Name: assign_delivery_rider(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_delivery_rider(p_order_id uuid, p_rider_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order RECORD;
    v_rider RECORD;
BEGIN
    -- Validate rider
    SELECT id, name, phone INTO v_rider
    FROM employees
    WHERE id = p_rider_id
      AND role = 'delivery_rider'
      AND status = 'active';
    
    IF v_rider.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive delivery rider');
    END IF;
    
    -- Get and lock order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.order_type != 'online' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only online orders can have delivery riders');
    END IF;
    
    IF v_order.status NOT IN ('ready', 'confirmed', 'preparing') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order must be ready, confirmed or preparing to assign rider');
    END IF;
    
    IF v_order.delivery_rider_id IS NOT NULL AND v_order.delivery_rider_id != p_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order already assigned to another rider');
    END IF;
    
    -- Update order with rider assignment
    UPDATE orders
    SET 
        delivery_rider_id = p_rider_id,
        status = CASE WHEN status = 'ready' THEN 'delivering'::order_status ELSE status END,
        delivery_started_at = CASE WHEN status = 'ready' THEN NOW() ELSE delivery_started_at END,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Create delivery history record
    PERFORM create_delivery_history_record(p_rider_id, p_order_id);
    
    -- Update history to 'delivering' if order was ready
    IF v_order.status = 'ready' THEN
        UPDATE delivery_history
        SET delivery_status = 'delivering',
            started_at = NOW(),
            updated_at = NOW()
        WHERE rider_id = p_rider_id AND order_id = p_order_id;
    END IF;
    
    -- Log status change
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (
        p_order_id, 
        CASE WHEN v_order.status = 'ready' THEN 'delivering' ELSE v_order.status::TEXT END,
        'Assigned to rider: ' || v_rider.name,
        p_rider_id,
        NOW()
    );
    
    -- Create notification for rider
    INSERT INTO notifications (user_type, user_id, title, message, type, reference_id, is_read, created_at)
    VALUES (
        'employee',
        p_rider_id,
        'ðŸš´ New Delivery Assigned!',
        'Order #' || v_order.order_number || ' - ' || v_order.customer_name || ' - Rs. ' || v_order.total,
        'delivery_assigned',
        p_order_id,
        FALSE,
        NOW()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'rider', jsonb_build_object(
            'id', v_rider.id,
            'name', v_rider.name,
            'phone', v_rider.phone
        ),
        'message', 'Rider assigned successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: FUNCTION assign_delivery_rider(p_order_id uuid, p_rider_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_delivery_rider(p_order_id uuid, p_rider_id uuid) IS 'Admin assigns a delivery rider to an order (creates history)';


--
-- Name: assign_table_to_order(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_table_to_order(p_order_id uuid, p_table_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if table is available
    IF NOT check_table_availability(p_table_id) THEN
        RETURN FALSE;
    END IF;
    
    -- Update order with table
    UPDATE orders
    SET table_id = p_table_id
    WHERE id = p_order_id;
    
    -- Update table status
    UPDATE restaurant_tables
    SET 
        status = 'occupied',
        current_order_id = p_order_id,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    RETURN TRUE;
END;
$$;


--
-- Name: auto_cleanup_otps_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_cleanup_otps_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Delete expired OTPs for the same email when new one is created
    DELETE FROM otp_codes 
    WHERE email = NEW.email 
      AND (expires_at < NOW() OR is_used = TRUE OR id != NEW.id);
    
    RETURN NEW;
END;
$$;


--
-- Name: auto_generate_menu_item_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_menu_item_slug() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Only generate slug if it's NULL or empty
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        -- Use the generate_slug function
        base_slug := generate_slug(NEW.name);
        final_slug := base_slug;
        
        -- Check for uniqueness and append counter if needed
        WHILE EXISTS (
            SELECT 1 FROM menu_items 
            WHERE slug = final_slug 
            AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        ) LOOP
            counter := counter + 1;
            final_slug := base_slug || '-' || counter;
        END LOOP;
        
        NEW.slug := final_slug;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: auto_log_order_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_log_order_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Automatically insert into status history
        INSERT INTO order_status_history (order_id, status, notes)
        VALUES (NEW.id, NEW.status, 'Status automatically updated to ' || NEW.status);
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: award_loyalty_promo_on_points_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_loyalty_promo_on_points_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Only process 'earned' type points
    IF NEW.type != 'earned' THEN
        RETURN NEW;
    END IF;
    
    IF NEW.customer_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Call check_and_award_loyalty_promo
    BEGIN
        SELECT check_and_award_loyalty_promo(NEW.customer_id) INTO v_result;
        
        IF (v_result->>'awarded')::BOOLEAN = true THEN
            RAISE NOTICE 'TRIGGER: Auto-awarded % promo(s) to customer %', 
                v_result->>'promos_awarded', NEW.customer_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'TRIGGER ERROR: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$;


--
-- Name: ban_customer(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ban_customer(p_customer_id uuid, p_reason text, p_banned_by uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_customer RECORD;
BEGIN
    -- Get customer info
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
    
    IF v_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    IF v_customer.is_banned = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer is already banned');
    END IF;
    
    -- Ban the customer
    UPDATE customers SET
        is_banned = true,
        ban_reason = p_reason,
        banned_at = NOW(),
        banned_by = p_banned_by,
        unbanned_at = NULL,
        unbanned_by = NULL
    WHERE id = p_customer_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Customer banned successfully',
        'customer_name', v_customer.name,
        'customer_email', v_customer.email
    );
END;
$$;


--
-- Name: bulk_activate_promo_codes_admin(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_activate_promo_codes_admin(p_promo_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE promo_codes
    SET is_active = true, updated_at = NOW()
    WHERE id = ANY(p_promo_ids);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'activated_count', v_count,
        'message', v_count || ' promo codes activated'
    );
END;
$$;


--
-- Name: bulk_deactivate_promo_codes_admin(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_deactivate_promo_codes_admin(p_promo_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE promo_codes
    SET is_active = false, updated_at = NOW()
    WHERE id = ANY(p_promo_ids);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'deactivated_count', v_count,
        'message', v_count || ' promo codes deactivated'
    );
END;
$$;


--
-- Name: bulk_delete_contact_messages(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_delete_contact_messages(p_message_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: bulk_delete_payslips(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_delete_payslips(p_payslip_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM payslips WHERE id = ANY(p_payslip_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN json_build_object('success', true, 'deleted_count', v_count);
END;
$$;


--
-- Name: bulk_delete_promo_codes_admin(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_delete_promo_codes_admin(p_promo_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM promo_codes
    WHERE id = ANY(p_promo_ids);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'deleted_count', v_count,
        'message', v_count || ' promo codes deleted'
    );
END;
$$;


--
-- Name: bulk_pay_payslips(uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_pay_payslips(p_payslip_ids uuid[], p_payment_method text DEFAULT 'bank_transfer'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE payslips
    SET status = 'paid',
        payment_method = p_payment_method,
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(p_payslip_ids)
    AND status = 'pending';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'paid_count', v_count
    );
END;
$$;


--
-- Name: bulk_update_contact_status(uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_update_contact_status(p_message_ids uuid[], p_status text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: bulk_update_employee_status(uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_update_employee_status(p_employee_ids uuid[], p_status text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_status NOT IN ('active', 'inactive', 'blocked', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  UPDATE employees SET
    status = p_status::employee_status,
    portal_enabled = CASE WHEN p_status = 'blocked' THEN false ELSE portal_enabled END,
    updated_at = NOW()
  WHERE id = ANY(p_employee_ids);
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated,
    'new_status', p_status
  );
END;
$$;


--
-- Name: bulk_update_review_visibility(uuid[], boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_update_review_visibility(p_review_ids uuid[], p_is_visible boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: bulk_update_review_visibility_by_employee(uuid[], boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_update_review_visibility_by_employee(p_review_ids uuid[], p_is_visible boolean, p_employee_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_role TEXT;
    v_affected INT;
BEGIN
    -- Check if employee exists and is manager or admin
    SELECT role INTO v_role 
    FROM employees 
    WHERE id = p_employee_id 
    AND status = 'active';
    
    IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW()
    WHERE id = ANY(p_review_ids);
    
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    
    RETURN json_build_object('success', true, 'affected_count', v_affected);
END;
$$;


--
-- Name: bulk_update_stock(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_update_stock(p_items jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    item JSONB;
    emp_id UUID;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    emp_id := get_employee_id();
    
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        BEGIN
            PERFORM adjust_inventory_stock(
                (item->>'item_id')::UUID,
                'count',
                (item->>'quantity')::DECIMAL,
                COALESCE(item->>'reason', 'Bulk inventory count')
            );
            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'updated', success_count,
        'errors', error_count
    );
END;
$$;


--
-- Name: calculate_loyalty_tier(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_loyalty_tier(lifetime_pts integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF lifetime_pts >= 10000 THEN
        RETURN 'platinum';
    ELSIF lifetime_pts >= 5000 THEN
        RETURN 'gold';
    ELSIF lifetime_pts >= 1000 THEN
        RETURN 'silver';
    ELSE
        RETURN 'bronze';
    END IF;
END;
$$;


--
-- Name: calculate_order_loyalty_points(numeric, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_order_loyalty_points(p_order_amount numeric, p_order_type text, p_is_first_order boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_base_settings JSONB;
    v_order_bonuses JSONB;
    v_dine_in_bonus JSONB;
    v_online_bonus JSONB;
    v_base_points INT := 0;
    v_bonus_points INT := 0;
    v_order_bonus INT := 0;
    v_type_bonus INT := 0;
BEGIN
    -- Get settings
    SELECT setting_value INTO v_base_settings FROM perks_settings WHERE setting_key = 'loyalty_points_per_order' AND is_active = true;
    SELECT setting_value INTO v_order_bonuses FROM perks_settings WHERE setting_key = 'order_amount_bonuses' AND is_active = true;
    SELECT setting_value INTO v_dine_in_bonus FROM perks_settings WHERE setting_key = 'dine_in_bonus' AND is_active = true;
    SELECT setting_value INTO v_online_bonus FROM perks_settings WHERE setting_key = 'online_order_bonus' AND is_active = true;
    
    -- Calculate base points if enabled and min amount met
    IF v_base_settings IS NOT NULL 
       AND (v_base_settings->>'enabled')::BOOLEAN = true
       AND p_order_amount >= COALESCE((v_base_settings->>'min_order_amount')::DECIMAL, 0) THEN
        
        v_base_points := FLOOR(p_order_amount / 100) * COALESCE((v_base_settings->>'points_per_100')::INT, 10);
        
        -- First order bonus
        IF p_is_first_order THEN
            v_bonus_points := COALESCE((v_base_settings->>'bonus_on_first_order')::INT, 0);
        END IF;
    END IF;
    
    -- Calculate order amount bonuses (with array type check)
    IF v_order_bonuses IS NOT NULL AND jsonb_typeof(v_order_bonuses) = 'array' THEN
        SELECT COALESCE(MAX((bonus->>'bonus_points')::INT), 0)
        INTO v_order_bonus
        FROM jsonb_array_elements(v_order_bonuses) bonus
        WHERE p_order_amount >= (bonus->>'min_amount')::DECIMAL;
    END IF;
    
    -- Calculate order type bonus
    IF p_order_type = 'dine-in' AND v_dine_in_bonus IS NOT NULL 
       AND (v_dine_in_bonus->>'enabled')::BOOLEAN = true
       AND p_order_amount >= COALESCE((v_dine_in_bonus->>'min_order_amount')::DECIMAL, 0) THEN
        v_type_bonus := COALESCE((v_dine_in_bonus->>'bonus_points')::INT, 0);
    ELSIF p_order_type IN ('delivery', 'online') AND v_online_bonus IS NOT NULL
       AND (v_online_bonus->>'enabled')::BOOLEAN = true
       AND p_order_amount >= COALESCE((v_online_bonus->>'min_order_amount')::DECIMAL, 0) THEN
        v_type_bonus := COALESCE((v_online_bonus->>'bonus_points')::INT, 0);
    END IF;
    
    RETURN json_build_object(
        'base_points', v_base_points,
        'first_order_bonus', v_bonus_points,
        'order_amount_bonus', v_order_bonus,
        'order_type_bonus', v_type_bonus,
        'total_points', v_base_points + v_bonus_points + v_order_bonus + v_type_bonus
    );
END;
$$;


--
-- Name: cancel_delivery_order(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_delivery_order(p_order_id uuid, p_reason text DEFAULT NULL::text, p_rider_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_history_exists BOOLEAN;
BEGIN
    -- Determine rider ID
    v_rider_id := COALESCE(p_rider_id, get_employee_id());
    
    IF v_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get and lock order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.delivery_rider_id != v_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'This order is not assigned to you');
    END IF;
    
    -- Update order - back to ready status
    UPDATE orders
    SET 
        status = 'ready',
        delivery_rider_id = NULL,
        delivery_started_at = NULL,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Check if history exists
    SELECT EXISTS(
        SELECT 1 FROM delivery_history 
        WHERE rider_id = v_rider_id AND order_id = p_order_id
    ) INTO v_history_exists;
    
    -- Update history if exists
    IF v_history_exists THEN
        UPDATE delivery_history
        SET 
            cancelled_at = NOW(),
            delivery_status = 'cancelled',
            delivery_notes = p_reason,
            updated_at = NOW()
        WHERE rider_id = v_rider_id AND order_id = p_order_id;
    END IF;
    
    -- Log status change
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, 'ready', 'Delivery cancelled: ' || COALESCE(p_reason, 'No reason provided'), v_rider_id, NOW());
    
    RETURN jsonb_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'message', 'Delivery cancelled. Order is back in queue.'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: FUNCTION cancel_delivery_order(p_order_id uuid, p_reason text, p_rider_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cancel_delivery_order(p_order_id uuid, p_reason text, p_rider_id uuid) IS 'Cancels delivery and returns order to queue (updates history)';


--
-- Name: cancel_leave_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_leave_request(p_request_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  emp_id UUID;
  request_record RECORD;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get and validate request
  SELECT * INTO request_record FROM leave_requests 
  WHERE id = p_request_id AND employee_id = emp_id;
  
  IF request_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found');
  END IF;
  
  IF request_record.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Can only cancel pending requests');
  END IF;
  
  UPDATE leave_requests
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN json_build_object('success', true, 'message', 'Leave request cancelled');
END;
$$;


--
-- Name: cancel_leave_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_leave_request(p_employee_id uuid, p_request_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  emp_id UUID;
  request_record RECORD;
BEGIN
  emp_id := resolve_employee_id(p_employee_id);
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  
  SELECT * INTO request_record FROM leave_requests WHERE id = p_request_id AND employee_id = emp_id;
  IF request_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Leave request not found'); END IF;
  IF request_record.status != 'pending' THEN RETURN json_build_object('success', false, 'error', 'Can only cancel pending requests'); END IF;
  
  UPDATE leave_requests SET status = 'cancelled', updated_at = NOW() WHERE id = p_request_id;
  RETURN json_build_object('success', true, 'message', 'Leave request cancelled');
END;
$$;


--
-- Name: cancel_order(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_order(p_order_id uuid, p_reason text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE orders
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_order_id AND status IN ('pending', 'confirmed');
    
    IF FOUND THEN
        INSERT INTO order_status_history (order_id, status, notes)
        VALUES (p_order_id, 'cancelled', p_reason);
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;


--
-- Name: cancel_order_by_waiter(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_order_by_waiter(p_order_id uuid, p_reason text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    order_record RECORD;
BEGIN
    emp_id := get_employee_id();
    
    -- Get order
    SELECT * INTO order_record
    FROM orders
    WHERE id = p_order_id;
    
    IF order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Check if waiter owns this order
    IF order_record.waiter_id != emp_id THEN
        RETURN json_build_object('success', false, 'error', 'Not your order');
    END IF;
    
    -- Check time limit
    IF order_record.can_cancel_until < NOW() THEN
        RETURN json_build_object('success', false, 'error', 'Cancellation time limit exceeded');
    END IF;
    
    -- Cancel order
    UPDATE orders
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Insert cancellation record
    INSERT INTO order_cancellations (order_id, cancelled_by, reason)
    VALUES (p_order_id, emp_id, p_reason);
    
    -- Free up table if dine-in
    IF order_record.order_type = 'dine-in' AND order_record.table_number IS NOT NULL THEN
        UPDATE restaurant_tables
        SET status = 'available',
            current_order_id = NULL,
            current_customers = 0,
            assigned_waiter_id = NULL,
            updated_at = NOW()
        WHERE table_number = order_record.table_number;
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: check_and_award_loyalty_promo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_award_loyalty_promo(p_customer_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_total_points INT;
    v_thresholds JSONB;
    v_threshold JSONB;
    v_promo_result JSON;
    v_already_awarded INT[];
    v_awarded_promos JSON[] := '{}';
    v_threshold_points INT;
BEGIN
    RAISE NOTICE 'Checking promo eligibility for customer: %', p_customer_id;
    
    -- Get customer's current total points
    SELECT COALESCE(SUM(points), 0)::INT
    INTO v_total_points
    FROM loyalty_points
    WHERE customer_id = p_customer_id;
    
    RAISE NOTICE 'Customer total points: %', v_total_points;
    
    -- Get ALL thresholds already awarded from BOTH tables
    SELECT ARRAY_AGG(DISTINCT threshold)
    INTO v_already_awarded
    FROM (
        SELECT loyalty_points_required as threshold 
        FROM customer_promo_codes 
        WHERE customer_id = p_customer_id AND loyalty_points_required IS NOT NULL
        UNION
        SELECT loyalty_points_required as threshold 
        FROM promo_codes 
        WHERE customer_id = p_customer_id AND loyalty_points_required IS NOT NULL
    ) combined;
    
    v_already_awarded := COALESCE(v_already_awarded, '{}');
    RAISE NOTICE 'Already awarded thresholds: %', v_already_awarded;
    
    -- Get loyalty thresholds settings
    SELECT setting_value
    INTO v_thresholds
    FROM perks_settings
    WHERE setting_key = 'loyalty_thresholds' AND is_active = true;
    
    IF v_thresholds IS NULL THEN
        RAISE NOTICE 'No loyalty_thresholds setting found!';
        RETURN json_build_object(
            'success', false, 
            'error', 'No thresholds configured',
            'total_points', v_total_points,
            'awarded', false
        );
    END IF;
    
    IF jsonb_typeof(v_thresholds) != 'array' THEN
        RAISE NOTICE 'loyalty_thresholds is not an array: %', jsonb_typeof(v_thresholds);
        RETURN json_build_object(
            'success', false, 
            'error', 'Thresholds config is invalid',
            'total_points', v_total_points,
            'awarded', false
        );
    END IF;
    
    RAISE NOTICE 'Found % threshold(s) to check', jsonb_array_length(v_thresholds);
    
    -- Check each threshold
    FOR v_threshold IN SELECT * FROM jsonb_array_elements(v_thresholds) ORDER BY (value->>'points')::INT ASC
    LOOP
        v_threshold_points := (v_threshold->>'points')::INT;
        RAISE NOTICE 'Checking threshold: % points (customer has: %)', v_threshold_points, v_total_points;
        
        IF v_total_points >= v_threshold_points THEN
            IF NOT (v_threshold_points = ANY(v_already_awarded)) THEN
                RAISE NOTICE 'Customer qualifies for % points threshold - generating promo...', v_threshold_points;
                
                -- Generate promo code
                SELECT generate_customer_promo_code(
                    p_customer_id,
                    v_threshold_points,
                    COALESCE(v_threshold->>'promo_type', 'percentage'),
                    COALESCE(v_threshold->>'promo_name', v_threshold_points || ' Points Reward'),
                    COALESCE((v_threshold->>'promo_value')::DECIMAL, 10),
                    (v_threshold->>'max_discount')::DECIMAL
                ) INTO v_promo_result;
                
                RAISE NOTICE 'Promo generation result: %', v_promo_result;
                
                IF v_promo_result IS NOT NULL AND (v_promo_result->>'success')::BOOLEAN = true THEN
                    v_awarded_promos := array_append(v_awarded_promos, v_promo_result);
                    v_already_awarded := array_append(v_already_awarded, v_threshold_points);
                END IF;
            ELSE
                RAISE NOTICE 'Customer already has promo for % points threshold', v_threshold_points;
            END IF;
        ELSE
            RAISE NOTICE 'Customer does not qualify for % points threshold (needs % more)', 
                v_threshold_points, v_threshold_points - v_total_points;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Total promos awarded: %', COALESCE(array_length(v_awarded_promos, 1), 0);
    
    RETURN json_build_object(
        'success', true,
        'total_points', v_total_points,
        'promos_awarded', COALESCE(array_length(v_awarded_promos, 1), 0),
        'awarded', COALESCE(array_length(v_awarded_promos, 1), 0) > 0,
        'new_promos', v_awarded_promos,
        'promo_code', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'code' ELSE NULL END,
        'promo_type', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'promo_type' ELSE NULL END,
        'value', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN (v_awarded_promos[1]->>'value')::DECIMAL ELSE NULL END,
        'max_discount', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN (v_awarded_promos[1]->>'max_discount')::DECIMAL ELSE NULL END,
        'expires_at', CASE WHEN array_length(v_awarded_promos, 1) > 0 THEN v_awarded_promos[1]->>'expires_at' ELSE NULL END
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'check_and_award_loyalty_promo failed: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM, 'total_points', 0, 'awarded', false);
END;
$$;


--
-- Name: check_customer_auth_status(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_customer_auth_status(p_email text) RETURNS TABLE(customer_id uuid, customer_email text, auth_user_id uuid, auth_email text, auth_exists boolean, auth_deleted boolean, auth_banned boolean, email_confirmed boolean, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.email,
    c.auth_user_id,
    u.email as auth_email,
    (u.id IS NOT NULL) as auth_exists,
    (u.deleted_at IS NOT NULL) as auth_deleted,
    (u.banned_until IS NOT NULL AND u.banned_until > NOW()) as auth_banned,
    (u.email_confirmed_at IS NOT NULL) as email_confirmed,
    CASE 
      WHEN c.auth_user_id IS NULL THEN 'NO_AUTH_USER'
      WHEN u.id IS NULL THEN 'AUTH_USER_NOT_FOUND'
      WHEN u.deleted_at IS NOT NULL THEN 'AUTH_USER_DELETED'
      WHEN u.banned_until IS NOT NULL AND u.banned_until > NOW() THEN 'AUTH_USER_BANNED'
      WHEN LOWER(TRIM(c.email)) != LOWER(TRIM(u.email)) THEN 'EMAIL_MISMATCH'
      ELSE 'HEALTHY'
    END as status
  FROM public.customers c
  LEFT JOIN auth.users u ON c.auth_user_id = u.id
  WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(p_email));
END;
$$;


--
-- Name: FUNCTION check_customer_auth_status(p_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_customer_auth_status(p_email text) IS 'Checks the auth status of a customer by email, returns detailed diagnostics';


--
-- Name: check_customer_review_limit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_customer_review_limit(p_customer_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: check_email_exists(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_email_exists(check_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM customers WHERE email = check_email
        UNION
        SELECT 1 FROM employees WHERE email = check_email
    );
END;
$$;


--
-- Name: check_employee_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_employee_by_email(p_email text) RETURNS TABLE(id uuid, status text, email text, role text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.status::text, e.email::text, e.role::text
  FROM employees e
  WHERE lower(e.email) = lower(trim(p_email))
  LIMIT 1;
END;
$$;


--
-- Name: check_employee_exists(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_employee_exists(p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_cnic text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_employee RECORD;
    v_cnic_clean TEXT;
BEGIN
    -- Check by email
    IF p_email IS NOT NULL AND p_email != '' THEN
        SELECT id, name, email INTO v_employee
        FROM employees
        WHERE LOWER(email) = LOWER(p_email)
        LIMIT 1;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'exists', TRUE,
                'field', 'email',
                'employee', jsonb_build_object('name', v_employee.name, 'email', v_employee.email)
            );
        END IF;
    END IF;
    
    -- Check by phone
    IF p_phone IS NOT NULL AND p_phone != '' THEN
        SELECT id, name, phone INTO v_employee
        FROM employees
        WHERE REGEXP_REPLACE(phone, '\s', '', 'g') = REGEXP_REPLACE(p_phone, '\s', '', 'g')
        LIMIT 1;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'exists', TRUE,
                'field', 'phone',
                'employee', jsonb_build_object('name', v_employee.name, 'phone', v_employee.phone)
            );
        END IF;
    END IF;
    
    -- Check by CNIC
    IF p_cnic IS NOT NULL AND p_cnic != '' THEN
        v_cnic_clean := REGEXP_REPLACE(p_cnic, '-', '', 'g');
        
        SELECT e.id, e.name, e.email INTO v_employee
        FROM employee_documents d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.document_type = 'cnic'
          AND d.document_name = v_cnic_clean
        LIMIT 1;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'exists', TRUE,
                'field', 'cnic',
                'employee', jsonb_build_object('name', v_employee.name, 'email', v_employee.email)
            );
        END IF;
    END IF;
    
    -- No match found
    RETURN jsonb_build_object('exists', FALSE);
END;
$$;


--
-- Name: check_employee_portal_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_employee_portal_access(p_email text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_employee RECORD;
BEGIN
  SELECT id, name, portal_enabled, block_reason
  INTO v_employee
  FROM employees 
  WHERE LOWER(email) = LOWER(p_email);

  IF v_employee IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'portal_enabled', false,
      'block_reason', null
    );
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'portal_enabled', COALESCE(v_employee.portal_enabled, true),
    'block_reason', v_employee.block_reason
  );
END;
$$;


--
-- Name: check_manager_or_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_manager_or_admin(p_caller_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  caller_id UUID;
  caller_role VARCHAR;
BEGIN
  caller_id := COALESCE(p_caller_id, get_employee_id());
  IF caller_id IS NULL THEN RETURN FALSE; END IF;
  SELECT role INTO caller_role FROM employees WHERE id = caller_id AND status = 'active';
  RETURN caller_role IN ('admin', 'manager');
END;
$$;


--
-- Name: check_password_reset_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_password_reset_rate_limit(p_email text, p_max_attempts integer DEFAULT 3, p_cooldown_hours integer DEFAULT 2) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_record RECORD;
  v_result JSON;
BEGIN
  -- Get existing rate limit record
  SELECT * INTO v_record
  FROM public.password_reset_rate_limits
  WHERE email = LOWER(p_email);

  -- If no record exists, create one and allow
  IF NOT FOUND THEN
    INSERT INTO public.password_reset_rate_limits (email, attempt_count, first_attempt_at, last_attempt_at)
    VALUES (LOWER(p_email), 1, NOW(), NOW());
    
    RETURN json_build_object(
      'allowed', true,
      'attempts', 1,
      'remaining', p_max_attempts - 1
    );
  END IF;

  -- Check if in cooldown period
  IF v_record.cooldown_until IS NOT NULL AND v_record.cooldown_until > NOW() THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'cooldown_until', v_record.cooldown_until,
      'remaining_minutes', EXTRACT(EPOCH FROM (v_record.cooldown_until - NOW())) / 60
    );
  END IF;

  -- Reset if first attempt was more than cooldown period ago
  IF v_record.first_attempt_at < NOW() - (p_cooldown_hours || ' hours')::INTERVAL THEN
    UPDATE public.password_reset_rate_limits
    SET attempt_count = 1,
        first_attempt_at = NOW(),
        last_attempt_at = NOW(),
        cooldown_until = NULL
    WHERE email = LOWER(p_email);
    
    RETURN json_build_object(
      'allowed', true,
      'attempts', 1,
      'remaining', p_max_attempts - 1
    );
  END IF;

  -- Check if max attempts reached
  IF v_record.attempt_count >= p_max_attempts THEN
    -- Set cooldown
    UPDATE public.password_reset_rate_limits
    SET cooldown_until = NOW() + (p_cooldown_hours || ' hours')::INTERVAL
    WHERE email = LOWER(p_email);
    
    RETURN json_build_object(
      'allowed', false,
      'reason', 'max_attempts',
      'cooldown_until', NOW() + (p_cooldown_hours || ' hours')::INTERVAL,
      'remaining_minutes', p_cooldown_hours * 60
    );
  END IF;

  -- Increment attempts
  UPDATE public.password_reset_rate_limits
  SET attempt_count = attempt_count + 1,
      last_attempt_at = NOW()
  WHERE email = LOWER(p_email);
  
  RETURN json_build_object(
    'allowed', true,
    'attempts', v_record.attempt_count + 1,
    'remaining', p_max_attempts - v_record.attempt_count - 1
  );
END;
$$;


--
-- Name: FUNCTION check_password_reset_rate_limit(p_email text, p_max_attempts integer, p_cooldown_hours integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_password_reset_rate_limit(p_email text, p_max_attempts integer, p_cooldown_hours integer) IS 'Checks and updates rate limit for password reset, returns JSON with allowed status';


--
-- Name: check_promo_code_details(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_promo_code_details(p_code text, p_customer_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_customer_promo RECORD;
    v_general_promo RECORD;
    v_is_valid BOOLEAN := false;
    v_error_message TEXT := NULL;
    v_promo_source TEXT := NULL;
    v_result JSON;
BEGIN
    -- First check customer-specific promo codes
    IF p_customer_id IS NOT NULL THEN
        SELECT * INTO v_customer_promo
        FROM customer_promo_codes
        WHERE UPPER(code) = UPPER(p_code);
        
        IF v_customer_promo IS NOT NULL THEN
            -- Found in customer promos
            v_promo_source := 'customer_reward';
            
            IF v_customer_promo.customer_id != p_customer_id THEN
                v_error_message := 'This promo code belongs to another customer';
            ELSIF v_customer_promo.is_used THEN
                v_error_message := 'This promo code has already been used';
            ELSIF v_customer_promo.expires_at < NOW() THEN
                v_error_message := 'This promo code has expired';
            ELSIF NOT v_customer_promo.is_active THEN
                v_error_message := 'This promo code is no longer active';
            ELSE
                v_is_valid := true;
            END IF;
            
            RETURN json_build_object(
                'found', true,
                'valid', v_is_valid,
                'error', v_error_message,
                'source', v_promo_source,
                'promo', json_build_object(
                    'id', v_customer_promo.id,
                    'code', v_customer_promo.code,
                    'name', v_customer_promo.name,
                    'description', v_customer_promo.description,
                    'promo_type', v_customer_promo.promo_type,
                    'value', v_customer_promo.value,
                    'max_discount', v_customer_promo.max_discount,
                    'loyalty_points_required', v_customer_promo.loyalty_points_required,
                    'is_used', v_customer_promo.is_used,
                    'used_at', v_customer_promo.used_at,
                    'expires_at', v_customer_promo.expires_at,
                    'is_active', v_customer_promo.is_active,
                    'created_at', v_customer_promo.created_at
                )
            );
        END IF;
    END IF;
    
    -- Check general promo codes
    SELECT * INTO v_general_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code);
    
    IF v_general_promo IS NULL THEN
        RETURN json_build_object(
            'found', false,
            'valid', false,
            'error', 'Promo code not found',
            'source', NULL,
            'promo', NULL
        );
    END IF;
    
    v_promo_source := 'general';
    
    IF NOT v_general_promo.is_active THEN
        v_error_message := 'This promo code is no longer active';
    ELSIF v_general_promo.valid_from > NOW() THEN
        v_error_message := 'This promo code is not yet active';
    ELSIF v_general_promo.valid_until < NOW() THEN
        v_error_message := 'This promo code has expired';
    ELSIF v_general_promo.usage_limit IS NOT NULL AND v_general_promo.current_usage >= v_general_promo.usage_limit THEN
        v_error_message := 'This promo code usage limit has been reached';
    ELSE
        v_is_valid := true;
    END IF;
    
    RETURN json_build_object(
        'found', true,
        'valid', v_is_valid,
        'error', v_error_message,
        'source', v_promo_source,
        'promo', json_build_object(
            'id', v_general_promo.id,
            'code', v_general_promo.code,
            'name', v_general_promo.name,
            'description', v_general_promo.description,
            'promo_type', v_general_promo.promo_type,
            'value', v_general_promo.value,
            'max_discount', v_general_promo.max_discount,
            'min_order_amount', v_general_promo.min_order_amount,
            'valid_from', v_general_promo.valid_from,
            'valid_until', v_general_promo.valid_until,
            'usage_limit', v_general_promo.usage_limit,
            'current_usage', v_general_promo.current_usage,
            'is_active', v_general_promo.is_active,
            'created_at', v_general_promo.created_at
        )
    );
END;
$$;


--
-- Name: check_table_availability(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_table_availability(p_table_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_is_available BOOLEAN;
BEGIN
    SELECT status = 'available' INTO v_is_available
    FROM restaurant_tables
    WHERE id = p_table_id;
    
    RETURN COALESCE(v_is_available, FALSE);
END;
$$;


--
-- Name: check_user_type(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_type(p_email text) RETURNS TABLE(user_type text, existing_user boolean, role text, employee_id text, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check employees first (includes admin)
    IF EXISTS (SELECT 1 FROM employees WHERE email = LOWER(p_email)) THEN
        RETURN QUERY
        SELECT 
            CASE WHEN e.role = 'admin' THEN 'admin' ELSE 'employee' END,
            TRUE,
            e.role::TEXT,
            e.employee_id,
            e.status::TEXT
        FROM employees e
        WHERE e.email = LOWER(p_email);
        RETURN;
    END IF;

    -- Check customers
    IF EXISTS (SELECT 1 FROM customers WHERE email = LOWER(p_email)) THEN
        RETURN QUERY
        SELECT 
            'customer'::TEXT,
            TRUE,
            NULL::TEXT,
            NULL::TEXT,
            CASE WHEN c.is_verified THEN 'active' ELSE 'pending' END
        FROM customers c
        WHERE c.email = LOWER(p_email);
        RETURN;
    END IF;

    -- New user
    RETURN QUERY SELECT 'customer'::TEXT, FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT;
END;
$$;


--
-- Name: claim_table_for_waiter(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_table_for_waiter(p_table_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_waiter_id UUID;
    v_waiter_record RECORD;
    v_table_record RECORD;
BEGIN
    -- Get current waiter
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Validate waiter role
    SELECT * INTO v_waiter_record FROM employees 
    WHERE id = v_waiter_id 
      AND role IN ('waiter', 'admin', 'manager')
      AND status = 'active'
      AND portal_enabled = true;
    
    IF v_waiter_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized as waiter');
    END IF;
    
    -- Get and lock the table (FOR UPDATE NOWAIT fails immediately if locked)
    BEGIN
        SELECT * INTO v_table_record FROM restaurant_tables 
        WHERE id = p_table_id
        FOR UPDATE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN
        RETURN json_build_object('success', false, 'error', 'Table is being claimed by another waiter');
    END;
    
    IF v_table_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    -- Check if table is available
    IF v_table_record.status != 'available' THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Table is not available. Current status: ' || v_table_record.status
        );
    END IF;
    
    -- Check if already assigned to another waiter
    IF v_table_record.assigned_waiter_id IS NOT NULL AND v_table_record.assigned_waiter_id != v_waiter_id THEN
        RETURN json_build_object('success', false, 'error', 'Table already assigned to another waiter');
    END IF;
    
    -- Claim the table
    UPDATE restaurant_tables
    SET 
        assigned_waiter_id = v_waiter_id,
        status = 'occupied',
        updated_at = NOW()
    WHERE id = p_table_id;
    
    -- Return success
    RETURN json_build_object(
        'success', true,
        'table_id', p_table_id,
        'table_number', v_table_record.table_number,
        'capacity', v_table_record.capacity,
        'waiter', json_build_object(
            'id', v_waiter_record.id,
            'name', v_waiter_record.name
        ),
        'claimed_at', NOW()
    );
END;
$$;


--
-- Name: FUNCTION claim_table_for_waiter(p_table_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.claim_table_for_waiter(p_table_id uuid) IS 'Atomic function to claim available table for waiter';


--
-- Name: cleanup_expired_attendance_codes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_attendance_codes() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete codes that are:
    -- 1. Expired (valid_until has passed for today's codes)
    -- 2. Inactive
    -- 3. From previous days
    DELETE FROM attendance_codes
    WHERE 
        -- Previous days codes
        valid_for_date < CURRENT_DATE
        OR 
        -- Today's expired codes (time has passed)
        (valid_for_date = CURRENT_DATE AND valid_until < LOCALTIME)
        OR
        -- Inactive codes
        is_active = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_expired_customer_promos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_customer_promos() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- Deactivate expired promo codes
    UPDATE promo_codes
    SET is_active = false, updated_at = NOW()
    WHERE valid_until < NOW() AND is_active = true;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'deactivated_count', v_count,
        'message', 'Expired promo codes cleaned up'
    );
END;
$$;


--
-- Name: cleanup_expired_otps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_otps() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otp_codes 
    WHERE expires_at < NOW() OR is_used = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_expired_password_otps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_password_otps() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.password_reset_otps
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;


--
-- Name: clear_all_favorites(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_all_favorites(p_customer_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE customers 
  SET favorites = '[]'::jsonb, updated_at = NOW()
  WHERE id = p_customer_id;
  
  RETURN FOUND;
END;
$$;


--
-- Name: complete_delivery(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_delivery(p_order_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    UPDATE orders
    SET status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id
    AND delivery_rider_id = emp_id;
    
    -- Add status history
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (p_order_id, 'delivered', emp_id);
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: complete_delivery_order(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_delivery_order(p_order_id uuid, p_notes text DEFAULT NULL::text, p_rider_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_rider_id UUID;
    v_order RECORD;
    v_delivery_minutes INT;
    v_history_exists BOOLEAN;
BEGIN
    -- Determine rider ID
    v_rider_id := COALESCE(p_rider_id, get_employee_id());
    
    IF v_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get and lock order
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.status NOT IN ('delivering'::order_status) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is not in delivering status. Current: ' || v_order.status::TEXT);
    END IF;
    
    IF v_order.delivery_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No rider assigned to this order');
    END IF;
    
    IF v_order.delivery_rider_id != v_rider_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'This order is not assigned to you');
    END IF;
    
    -- Calculate delivery time from order's delivery_started_at
    IF v_order.delivery_started_at IS NOT NULL THEN
        v_delivery_minutes := EXTRACT(EPOCH FROM (NOW() - v_order.delivery_started_at)) / 60;
    ELSE
        v_delivery_minutes := 0;
    END IF;
    
    -- Update order to delivered
    UPDATE orders
    SET 
        status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Check if history exists
    SELECT EXISTS(
        SELECT 1 FROM delivery_history 
        WHERE rider_id = v_rider_id AND order_id = p_order_id
    ) INTO v_history_exists;
    
    -- Create history if it doesn't exist (for orders assigned by admin before this fix)
    IF NOT v_history_exists THEN
        PERFORM create_delivery_history_record(v_rider_id, p_order_id);
    END IF;
    
    -- Update delivery history
    UPDATE delivery_history
    SET 
        delivered_at = NOW(),
        delivery_status = 'delivered',
        actual_delivery_minutes = v_delivery_minutes,
        delivery_notes = p_notes,
        started_at = COALESCE(started_at, v_order.delivery_started_at),
        updated_at = NOW()
    WHERE rider_id = v_rider_id AND order_id = p_order_id;
    
    -- Log status change
    INSERT INTO order_status_history (order_id, status, notes, changed_by, created_at)
    VALUES (p_order_id, 'delivered', COALESCE(p_notes, 'Delivery completed'), v_rider_id, NOW());
    
    -- Create notification for customer
    IF v_order.customer_id IS NOT NULL THEN
        INSERT INTO notifications (user_type, user_id, title, message, type, reference_id, is_read, created_at)
        VALUES (
            'customer',
            v_order.customer_id,
            'ðŸ“¦ Order Delivered!',
            'Your order #' || v_order.order_number || ' has been delivered. Enjoy your meal!',
            'order_delivered',
            p_order_id,
            FALSE,
            NOW()
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'order_number', v_order.order_number,
        'delivery_minutes', v_delivery_minutes,
        'message', 'Delivery completed successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: FUNCTION complete_delivery_order(p_order_id uuid, p_notes text, p_rider_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.complete_delivery_order(p_order_id uuid, p_notes text, p_rider_id uuid) IS 'Marks delivery as completed (updates history with delivery time)';


--
-- Name: confirm_payment(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_payment(p_order_id uuid, p_confirmed_by uuid) RETURNS TABLE(success boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_customer_id UUID;
    v_order_number TEXT;
BEGIN
    -- Get order info
    SELECT customer_id, order_number INTO v_customer_id, v_order_number
    FROM orders WHERE id = p_order_id;

    IF v_customer_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Order not found';
        RETURN;
    END IF;

    -- Update payment status
    UPDATE orders
    SET 
        payment_status = 'paid',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Add to history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, (SELECT status FROM orders WHERE id = p_order_id), 
            p_confirmed_by, 'Payment confirmed');

    -- Notify customer
    INSERT INTO notifications (user_type, user_id, title, message, type, data)
    VALUES (
        'customer', v_customer_id,
        'Payment Confirmed âœ…',
        'Your payment for order ' || v_order_number || ' has been confirmed!',
        'payment',
        jsonb_build_object('order_id', p_order_id)
    );

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;


--
-- Name: create_bulk_notifications(text, text, text, text, public.user_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_bulk_notifications(p_user_type text, p_title text, p_message text, p_type text, p_role public.user_role DEFAULT NULL::public.user_role) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INT := 0;
BEGIN
    IF p_user_type = 'customer' THEN
        INSERT INTO notifications (user_type, user_id, title, message, type)
        SELECT 'customer', c.id, p_title, p_message, p_type
        FROM customers c
        WHERE c.email IS NOT NULL;
        GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSIF p_user_type = 'employee' THEN
        INSERT INTO notifications (user_type, user_id, title, message, type)
        SELECT 'employee', e.id, p_title, p_message, p_type
        FROM employees e
        WHERE e.is_verified = true
        AND (p_role IS NULL OR e.role = p_role);
        GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;
    
    RETURN v_count;
END;
$$;


--
-- Name: create_contact_message(text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_contact_message(p_name text, p_email text, p_message text, p_phone text DEFAULT NULL::text, p_subject text DEFAULT NULL::text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
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
$_$;


--
-- Name: create_customer_notification(uuid, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_customer_notification(p_customer_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO notifications (
        user_type,
        user_id,
        title,
        message,
        type,
        reference_id,
        is_read,
        created_at
    ) VALUES (
        'customer',
        p_customer_id,
        p_title,
        p_message,
        p_type,
        p_reference_id,
        FALSE,
        NOW()
    );
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


--
-- Name: FUNCTION create_customer_notification(p_customer_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_customer_notification(p_customer_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid) IS 'Creates a notification for a customer';


--
-- Name: create_customer_order(uuid, text, text, text, text, text, text, jsonb, numeric, numeric, numeric, numeric, numeric, text, text, integer, text, text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_customer_order(p_customer_id uuid, p_order_number text, p_customer_name text, p_customer_email text, p_customer_phone text, p_customer_address text, p_order_type text, p_items jsonb, p_subtotal numeric, p_tax numeric, p_delivery_fee numeric, p_discount numeric, p_total numeric, p_payment_method text, p_payment_status text, p_table_number integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text, p_transaction_id text DEFAULT NULL::text, p_online_payment_method_id uuid DEFAULT NULL::uuid, p_online_payment_details jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order_id UUID;
    v_customer_exists BOOLEAN;
BEGIN
    -- Validate customer exists
    SELECT EXISTS(SELECT 1 FROM customers WHERE id = p_customer_id) INTO v_customer_exists;
    
    IF NOT v_customer_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Customer not found'
        );
    END IF;

    -- Validate order type
    IF p_order_type NOT IN ('online', 'walk-in', 'dine-in') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid order type'
        );
    END IF;

    -- Validate payment method
    IF p_payment_method NOT IN ('cash', 'card', 'online', 'wallet') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid payment method'
        );
    END IF;

    -- Create the order
    INSERT INTO orders (
        customer_id,
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        order_type,
        items,
        subtotal,
        tax,
        delivery_fee,
        discount,
        total,
        payment_method,
        payment_status,
        status,
        table_number,
        notes,
        transaction_id,
        online_payment_method_id,
        online_payment_details,
        created_at,
        updated_at
    ) VALUES (
        p_customer_id,
        p_order_number,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_customer_address,
        p_order_type::order_type,
        p_items,
        p_subtotal,
        p_tax,
        p_delivery_fee,
        p_discount,
        p_total,
        p_payment_method::payment_method,
        COALESCE(p_payment_status, 'pending'),
        'pending'::order_status,
        p_table_number,
        p_notes,
        p_transaction_id,
        p_online_payment_method_id,
        p_online_payment_details,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_order_id;

    -- Create initial order status history
    INSERT INTO order_status_history (order_id, status, notes, created_at)
    VALUES (v_order_id, 'pending', 'Order placed by customer', NOW());

    -- Return success with order ID
    RETURN jsonb_build_object(
        'success', true,
        'id', v_order_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;


--
-- Name: FUNCTION create_customer_order(p_customer_id uuid, p_order_number text, p_customer_name text, p_customer_email text, p_customer_phone text, p_customer_address text, p_order_type text, p_items jsonb, p_subtotal numeric, p_tax numeric, p_delivery_fee numeric, p_discount numeric, p_total numeric, p_payment_method text, p_payment_status text, p_table_number integer, p_notes text, p_transaction_id text, p_online_payment_method_id uuid, p_online_payment_details jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_customer_order(p_customer_id uuid, p_order_number text, p_customer_name text, p_customer_email text, p_customer_phone text, p_customer_address text, p_order_type text, p_items jsonb, p_subtotal numeric, p_tax numeric, p_delivery_fee numeric, p_discount numeric, p_total numeric, p_payment_method text, p_payment_status text, p_table_number integer, p_notes text, p_transaction_id text, p_online_payment_method_id uuid, p_online_payment_details jsonb) IS 'Creates a customer order bypassing RLS - validates customer exists';


--
-- Name: create_deal(text, text, text, text, numeric, numeric, numeric, timestamp without time zone, timestamp without time zone, integer, boolean, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_deal(p_name text, p_description text DEFAULT NULL::text, p_code text DEFAULT NULL::text, p_discount_type text DEFAULT 'percentage'::text, p_discount_value numeric DEFAULT 10, p_min_order_amount numeric DEFAULT NULL::numeric, p_max_discount numeric DEFAULT NULL::numeric, p_start_date timestamp without time zone DEFAULT now(), p_end_date timestamp without time zone DEFAULT NULL::timestamp without time zone, p_usage_limit integer DEFAULT NULL::integer, p_is_active boolean DEFAULT true, p_items jsonb DEFAULT NULL::jsonb, p_image_url text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_deal_id UUID;
    actual_code TEXT;
    v_promo_type promo_type;
    v_valid_from TIMESTAMP WITH TIME ZONE;
    v_valid_until TIMESTAMP WITH TIME ZONE;
    v_applicable_items JSONB;
BEGIN
    -- Note: Portal access already requires authentication
    -- Skip manager/admin check to allow any authenticated portal user
    
    -- Generate unique code if not provided
    actual_code := COALESCE(p_code, UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 8)));
    
    -- Map discount type to enum (promo_type enum values: percentage, fixed_amount, free_item, loyalty_points)
    v_promo_type := CASE 
        WHEN p_discount_type = 'percentage' THEN 'percentage'::promo_type
        WHEN p_discount_type = 'fixed' THEN 'fixed_amount'::promo_type
        WHEN p_discount_type = 'fixed_amount' THEN 'fixed_amount'::promo_type
        WHEN p_discount_type = 'bogo' THEN 'free_item'::promo_type
        WHEN p_discount_type = 'free_item' THEN 'free_item'::promo_type
        ELSE 'percentage'::promo_type
    END;
    
    -- Set default dates if not provided
    v_valid_from := COALESCE(p_start_date, NOW());
    v_valid_until := COALESCE(p_end_date, NOW() + INTERVAL '30 days');
    
    -- Build applicable_items JSONB with items and image
    v_applicable_items := jsonb_build_object(
        'items', COALESCE(p_items, '[]'::jsonb),
        'image_url', p_image_url
    );
    
    INSERT INTO promo_codes (
        code,
        name, 
        description, 
        promo_type, 
        value,
        min_order_amount, 
        max_discount, 
        valid_from, 
        valid_until,
        usage_limit, 
        is_active,
        applicable_items
    ) VALUES (
        actual_code,
        p_name, 
        COALESCE(p_description, 'Promotional deal'),
        v_promo_type, 
        COALESCE(p_discount_value, 10),
        COALESCE(p_min_order_amount, 0), 
        p_max_discount, 
        v_valid_from, 
        v_valid_until,
        p_usage_limit, 
        COALESCE(p_is_active, true),
        v_applicable_items
    ) RETURNING id INTO new_deal_id;
    
    RETURN json_build_object(
        'success', true, 
        'id', new_deal_id, 
        'code', actual_code,
        'name', p_name,
        'valid_from', v_valid_from,
        'valid_until', v_valid_until
    );
END;
$$;


--
-- Name: create_deal_with_items(text, text, text, text, numeric, numeric, text, timestamp with time zone, timestamp with time zone, integer, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_deal_with_items(p_name text, p_description text, p_code text, p_deal_type text, p_original_price numeric, p_discounted_price numeric, p_image_url text, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone, p_usage_limit integer, p_is_active boolean, p_items jsonb) RETURNS TABLE(id uuid, code text, slug text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_deal_id UUID;
    v_code TEXT;
    v_slug TEXT;
    v_discount_percentage DECIMAL;
    v_item JSONB;
    v_image_url TEXT;
BEGIN
    -- Generate code if not provided (or empty)
    v_code := COALESCE(NULLIF(TRIM(p_code), ''), 'DEAL' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)));
    
    -- Generate slug from name
    v_slug := LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := REGEXP_REPLACE(v_slug, '^-|-$', '', 'g');
    v_slug := v_slug || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
    
    -- Calculate discount percentage
    IF p_original_price > 0 THEN
        v_discount_percentage := ROUND(((p_original_price - p_discounted_price) / p_original_price) * 100, 2);
    ELSE
        v_discount_percentage := 0;
    END IF;
    
    -- Process image URL - keep as-is if already full URL, otherwise it's already processed by frontend
    v_image_url := p_image_url;
    
    -- Insert the deal
    INSERT INTO deals (
        name, slug, description, code,
        original_price, discounted_price, discount_percentage,
        images, valid_from, valid_until, usage_limit, is_active
    ) VALUES (
        p_name, v_slug, p_description, v_code,
        p_original_price, p_discounted_price, v_discount_percentage,
        CASE WHEN v_image_url IS NOT NULL AND v_image_url != '' THEN jsonb_build_array(v_image_url) ELSE '[]'::jsonb END,
        p_valid_from, p_valid_until, p_usage_limit, p_is_active
    ) RETURNING deals.id INTO v_deal_id;
    
    -- Insert items into deal_items relational table
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO deal_items (deal_id, menu_item_id, quantity)
            VALUES (
                v_deal_id,
                (v_item->>'id')::UUID,
                COALESCE((v_item->>'quantity')::INT, 1)
            )
            ON CONFLICT (deal_id, menu_item_id) DO UPDATE SET quantity = EXCLUDED.quantity;
        END LOOP;
    END IF;
    
    RETURN QUERY SELECT v_deal_id, v_code, v_slug;
END;
$_$;


--
-- Name: create_delivery_history_record(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_delivery_history_record(p_rider_id uuid, p_order_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Get order details
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Insert or update delivery history
    INSERT INTO delivery_history (
        rider_id,
        order_id,
        order_number,
        order_snapshot,
        customer_name,
        customer_phone,
        customer_address,
        customer_email,
        items,
        total_items,
        subtotal,
        delivery_fee,
        total,
        payment_method,
        payment_status,
        accepted_at,
        delivery_status
    ) VALUES (
        p_rider_id,
        v_order.id,
        v_order.order_number,
        row_to_json(v_order)::jsonb,
        v_order.customer_name,
        v_order.customer_phone,
        v_order.customer_address,
        v_order.customer_email,
        v_order.items,
        COALESCE(jsonb_array_length(v_order.items::jsonb), 0),
        COALESCE(v_order.subtotal, 0),
        COALESCE(v_order.delivery_fee, 0),
        COALESCE(v_order.total, 0),
        v_order.payment_method::TEXT,
        v_order.payment_status,
        NOW(),
        'accepted'
    )
    ON CONFLICT (rider_id, order_id) DO UPDATE SET
        order_snapshot = EXCLUDED.order_snapshot,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        customer_address = EXCLUDED.customer_address,
        items = EXCLUDED.items,
        total = EXCLUDED.total,
        updated_at = NOW();
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating delivery history: %', SQLERRM;
    RETURN FALSE;
END;
$$;


--
-- Name: FUNCTION create_delivery_history_record(p_rider_id uuid, p_order_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_delivery_history_record(p_rider_id uuid, p_order_id uuid) IS 'Helper function to create a delivery history record for an order';


--
-- Name: create_dine_in_order(uuid, integer, jsonb, uuid, character varying, character varying, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_dine_in_order(p_table_id uuid, p_customer_count integer, p_items jsonb, p_customer_id uuid DEFAULT NULL::uuid, p_customer_name character varying DEFAULT NULL::character varying, p_customer_phone character varying DEFAULT NULL::character varying, p_notes text DEFAULT NULL::text, p_send_confirmation boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    new_order_id UUID;
    table_num INTEGER;
    calculated_subtotal DECIMAL(10, 2);
    calculated_total DECIMAL(10, 2);
    result JSON;
BEGIN
    emp_id := get_employee_id();
    
    -- Check if waiter can take orders
    IF NOT can_take_orders() THEN
        RAISE EXCEPTION 'Not authorized to take orders';
    END IF;
    
    -- Get table number
    SELECT table_number INTO table_num FROM restaurant_tables WHERE id = p_table_id;
    
    -- Calculate totals from items
    SELECT COALESCE(SUM((item->>'price')::DECIMAL * (item->>'quantity')::INTEGER), 0)
    INTO calculated_subtotal
    FROM jsonb_array_elements(p_items) as item;
    
    calculated_total := calculated_subtotal; -- Add tax/delivery logic if needed
    
    -- Create order with AUTO-CONFIRMED status for dine-in
    INSERT INTO orders (
        customer_id, customer_name, customer_phone,
        order_type, items, subtotal, total,
        payment_method, table_number, notes,
        waiter_id, assigned_to, can_cancel_until,
        status  -- Explicitly set status to confirmed
    ) VALUES (
        p_customer_id,
        COALESCE(p_customer_name, 'Walk-in Customer'),
        COALESCE(p_customer_phone, ''),
        'dine-in',
        p_items,
        calculated_subtotal,
        calculated_total,
        'cash',
        table_num,
        p_notes,
        emp_id,
        emp_id,
        NOW() + INTERVAL '5 minutes',
        'confirmed'  -- Auto-confirmed for dine-in orders
    ) RETURNING id INTO new_order_id;
    
    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (new_order_id, 'confirmed'::order_status, emp_id, 'Auto-confirmed dine-in order');
    
    -- Update table
    UPDATE restaurant_tables
    SET status = 'occupied',
        current_order_id = new_order_id,
        current_customers = p_customer_count,
        assigned_waiter_id = emp_id,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    -- Update employee stats
    UPDATE employees
    SET total_orders_taken = total_orders_taken + 1,
        updated_at = NOW()
    WHERE id = emp_id;
    
    -- Insert table history
    INSERT INTO table_history (table_id, order_id, waiter_id, customer_count, opened_at)
    VALUES (p_table_id, new_order_id, emp_id, p_customer_count, NOW());
    
    RETURN json_build_object(
        'success', true,
        'order_id', new_order_id,
        'order_number', (SELECT order_number FROM orders WHERE id = new_order_id),
        'status', 'confirmed',
        'send_confirmation', p_send_confirmation
    );
END;
$$;


--
-- Name: create_employee(text, text, text, public.user_role, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_employee(p_email text, p_name text, p_phone text, p_role public.user_role, p_permissions jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_employee_id TEXT;
    v_result JSONB;
BEGIN
    INSERT INTO employees (email, name, phone, role, permissions, status)
    VALUES (p_email, p_name, p_phone, p_role, p_permissions, 'pending')
    RETURNING jsonb_build_object(
        'id', id,
        'employee_id', employee_id,
        'email', email,
        'name', name,
        'phone', phone,
        'role', role,
        'status', status,
        'created_at', created_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


--
-- Name: create_employee(character varying, character varying, character varying, text, numeric, date, jsonb, text, character varying, character varying, date, character varying, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_employee(p_name character varying, p_email character varying, p_phone character varying, p_role text, p_salary numeric, p_hired_date date, p_documents jsonb DEFAULT '[]'::jsonb, p_address text DEFAULT NULL::text, p_emergency_contact character varying DEFAULT NULL::character varying, p_emergency_contact_name character varying DEFAULT NULL::character varying, p_date_of_birth date DEFAULT NULL::date, p_blood_group character varying DEFAULT NULL::character varying, p_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_employee_id UUID;
    new_license_id TEXT;
    result JSON;
BEGIN
    -- Check if caller is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admin can create employees';
    END IF;
    
    -- Generate unique license ID
    new_license_id := generate_license_id();
    
    -- Ensure license is unique
    WHILE EXISTS (SELECT 1 FROM employee_licenses WHERE license_id = new_license_id) LOOP
        new_license_id := generate_license_id();
    END LOOP;
    
    -- Insert employee
    INSERT INTO employees (
        name, email, phone, role, salary, hired_date,
        address, emergency_contact, emergency_contact_name,
        date_of_birth, blood_group, notes,
        status, license_id, created_by, portal_enabled
    ) VALUES (
        p_name, p_email, p_phone, p_role::user_role, p_salary, p_hired_date,
        p_address, p_emergency_contact, p_emergency_contact_name,
        p_date_of_birth, p_blood_group, p_notes,
        'pending', new_license_id, get_employee_id(), false
    ) RETURNING id INTO new_employee_id;
    
    -- Create license record
    INSERT INTO employee_licenses (
        employee_id, license_id, expires_at
    ) VALUES (
        new_employee_id, new_license_id, NOW() + INTERVAL '7 days'
    );
    
    -- Insert documents if provided
    IF p_documents IS NOT NULL AND jsonb_array_length(p_documents) > 0 THEN
        INSERT INTO employee_documents (employee_id, document_type, document_name, file_url, file_type)
        SELECT 
            new_employee_id,
            doc->>'type',
            doc->>'name',
            doc->>'url',
            doc->>'fileType'
        FROM jsonb_array_elements(p_documents) as doc;
    END IF;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'employee_id', new_employee_id,
        'license_id', new_license_id,
        'employee', (
            SELECT row_to_json(e.*)
            FROM employees e
            WHERE e.id = new_employee_id
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: create_employee_complete(text, text, text, text, text, text, text, text, text, date, text, text, public.user_role, jsonb, boolean, numeric, text, jsonb, date, text, text, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_employee_complete(p_employee_id text, p_name text, p_email text, p_phone text, p_cnic text, p_cnic_file_url text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_emergency_contact text DEFAULT NULL::text, p_emergency_contact_name text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_blood_group text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text, p_role public.user_role DEFAULT 'waiter'::public.user_role, p_permissions jsonb DEFAULT '{}'::jsonb, p_portal_enabled boolean DEFAULT true, p_base_salary numeric DEFAULT 25000, p_payment_frequency text DEFAULT 'monthly'::text, p_bank_details jsonb DEFAULT '{}'::jsonb, p_hired_date date DEFAULT CURRENT_DATE, p_notes text DEFAULT NULL::text, p_license_id text DEFAULT NULL::text, p_license_expires_days integer DEFAULT 7, p_documents jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_new_employee_id UUID;
    v_generated_emp_id TEXT;
    v_generated_license_id TEXT;
    v_current_month INT;
    v_current_year INT;
    v_doc JSONB;
    v_result JSONB;
BEGIN
    -- Generate employee_id if not provided
    v_generated_emp_id := COALESCE(NULLIF(p_employee_id, ''), 
        CASE p_role::TEXT
            WHEN 'admin' THEN 'ADM-'
            WHEN 'manager' THEN 'MGR-'
            WHEN 'waiter' THEN 'WTR-'
            WHEN 'billing_staff' THEN 'BIL-'
            WHEN 'kitchen_staff' THEN 'KIT-'
            WHEN 'delivery_rider' THEN 'DLR-'
            ELSE 'EMP-'
        END || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
    );
    
    -- Generate license_id if not provided
    v_generated_license_id := COALESCE(NULLIF(p_license_id, ''),
        'LIC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4))
    );
    
    -- Get current month/year for payroll
    v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);
    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- =====================================================
    -- 1. INSERT EMPLOYEE
    -- =====================================================
    INSERT INTO employees (
        employee_id,
        name,
        email,
        phone,
        role,
        status,
        permissions,
        salary,
        hired_date,
        license_id,
        avatar_url,
        address,
        emergency_contact,
        emergency_contact_name,
        date_of_birth,
        blood_group,
        portal_enabled,
        bank_details,
        notes,
        created_at,
        updated_at
    ) VALUES (
        v_generated_emp_id,
        p_name,
        LOWER(p_email),
        REGEXP_REPLACE(p_phone, '\s', '', 'g'),
        p_role,
        'inactive',
        p_permissions,
        p_base_salary,
        p_hired_date,
        v_generated_license_id,
        p_avatar_url,
        p_address,
        p_emergency_contact,
        p_emergency_contact_name,
        p_date_of_birth,
        p_blood_group,
        p_portal_enabled,
        p_bank_details,
        p_notes,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_employee_id;
    
    -- =====================================================
    -- 2. INSERT LICENSE
    -- =====================================================
    INSERT INTO employee_licenses (
        employee_id,
        license_id,
        issued_at,
        is_used,
        expires_at
    ) VALUES (
        v_new_employee_id,
        v_generated_license_id,
        NOW(),
        FALSE,
        NOW() + (p_license_expires_days || ' days')::INTERVAL
    );
    
    -- =====================================================
    -- 3. INSERT CNIC DOCUMENT (Primary ID)
    -- =====================================================
    IF p_cnic IS NOT NULL AND p_cnic != '' THEN
        INSERT INTO employee_documents (
            employee_id,
            document_type,
            document_name,
            file_url,
            file_type,
            uploaded_at,
            verified
        ) VALUES (
            v_new_employee_id,
            'cnic',
            REGEXP_REPLACE(p_cnic, '-', '', 'g'),
            COALESCE(p_cnic_file_url, ''),
            CASE WHEN p_cnic_file_url IS NOT NULL AND p_cnic_file_url != '' THEN 'image' ELSE 'text' END,
            NOW(),
            FALSE
        );
    END IF;
    
    -- =====================================================
    -- 4. INSERT ADDITIONAL DOCUMENTS (Bulk insert)
    -- =====================================================
    IF p_documents IS NOT NULL AND jsonb_array_length(p_documents) > 0 THEN
        INSERT INTO employee_documents (
            employee_id,
            document_type,
            document_name,
            file_url,
            file_type,
            uploaded_at,
            verified
        )
        SELECT 
            v_new_employee_id,
            doc->>'type',
            COALESCE(doc->>'number', doc->>'type'),
            COALESCE(doc->>'file_url', ''),
            COALESCE(doc->>'file_type', 'unknown'),
            NOW(),
            FALSE
        FROM jsonb_array_elements(p_documents) AS doc
        WHERE doc->>'type' != 'cnic'
          AND (
              (doc->>'number' IS NOT NULL AND doc->>'number' != '') OR
              (doc->>'file_url' IS NOT NULL AND doc->>'file_url' != '')
          );
    END IF;
    
    -- =====================================================
    -- 5. INSERT INITIAL PAYROLL RECORD
    -- =====================================================
    INSERT INTO employee_payroll (
        employee_id,
        month,
        year,
        base_salary,
        bonus,
        deductions,
        tips,
        total_amount,
        paid,
        created_at,
        updated_at
    ) VALUES (
        v_new_employee_id,
        v_current_month,
        v_current_year,
        COALESCE(p_base_salary, 0),
        0,
        0,
        0,
        COALESCE(p_base_salary, 0),
        FALSE,
        NOW(),
        NOW()
    );
    
    -- =====================================================
    -- 6. BUILD AND RETURN RESULT
    -- =====================================================
    SELECT jsonb_build_object(
        'success', TRUE,
        'data', jsonb_build_object(
            'employee', jsonb_build_object(
                'id', e.id,
                'employee_id', e.employee_id,
                'name', e.name,
                'email', e.email,
                'phone', e.phone,
                'role', e.role,
                'status', e.status,
                'license_id', e.license_id,
                'hired_date', e.hired_date,
                'portal_enabled', e.portal_enabled,
                'avatar_url', e.avatar_url,
                'created_at', e.created_at
            ),
            'employee_id', v_generated_emp_id,
            'license_id', v_generated_license_id,
            'license_expires_at', NOW() + (p_license_expires_days || ' days')::INTERVAL
        )
    ) INTO v_result
    FROM employees e
    WHERE e.id = v_new_employee_id;
    
    RETURN v_result;
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Employee with this email, phone, or employee ID already exists'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$;


--
-- Name: create_employee_inactive(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_employee_inactive(p_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_employee_id TEXT;
  v_license_id TEXT;
  v_new_employee_uuid UUID;
  v_role TEXT;
BEGIN
  -- Validate required fields
  IF p_data->>'name' IS NULL OR p_data->>'email' IS NULL OR p_data->>'phone' IS NULL OR p_data->>'role' IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required fields: name, email, phone, role');
  END IF;

  -- Check for duplicate email
  IF EXISTS (SELECT 1 FROM employees WHERE email = p_data->>'email') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email already exists');
  END IF;

  -- Check for duplicate phone
  IF EXISTS (SELECT 1 FROM employees WHERE phone = p_data->>'phone') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Phone number already exists');
  END IF;

  v_role := p_data->>'role';

  -- Generate unique employee ID based on role
  v_employee_id := CASE v_role
    WHEN 'admin' THEN 'ADM-'
    WHEN 'manager' THEN 'MGR-'
    WHEN 'waiter' THEN 'WTR-'
    WHEN 'billing_staff' THEN 'BIL-'
    WHEN 'kitchen_staff' THEN 'KIT-'
    WHEN 'delivery_rider' THEN 'DLR-'
    ELSE 'STF-'
  END || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

  -- Generate license ID
  v_license_id := 'LIC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 5 FOR 4)) || '-' ||
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 9 FOR 4));

  -- Insert employee with INACTIVE status (pending activation)
  INSERT INTO employees (
    employee_id,
    name,
    email,
    phone,
    role,
    status,
    portal_enabled,
    salary,
    hired_date,
    address,
    emergency_contact,
    emergency_contact_name,
    date_of_birth,
    blood_group,
    permissions,
    bank_details,
    notes,
    license_id,
    avatar_url
  ) VALUES (
    v_employee_id,
    p_data->>'name',
    p_data->>'email',
    p_data->>'phone',
    (p_data->>'role')::employee_role,
    'inactive'::employee_status,  -- INACTIVE by default
    COALESCE((p_data->>'portal_enabled')::BOOLEAN, false),  -- Portal disabled by default
    COALESCE((p_data->>'salary')::NUMERIC, 0),
    COALESCE((p_data->>'hired_date')::DATE, CURRENT_DATE),
    p_data->>'address',
    p_data->>'emergency_contact',
    p_data->>'emergency_contact_name',
    (p_data->>'date_of_birth')::DATE,
    p_data->>'blood_group',
    COALESCE((p_data->'permissions')::JSONB, '{}'::JSONB),
    COALESCE((p_data->'bank_details')::JSONB, '{}'::JSONB),
    p_data->>'notes',
    v_license_id,
    p_data->>'avatar_url'
  )
  RETURNING id INTO v_new_employee_uuid;

  -- Create license record
  INSERT INTO employee_licenses (
    employee_id,
    license_id,
    is_used,
    expires_at
  ) VALUES (
    v_new_employee_uuid,
    v_license_id,
    false,
    NOW() + INTERVAL '7 days'  -- License valid for 7 days
  );

  -- Log creation in audit
  INSERT INTO audit_logs (action, table_name, record_id, new_data)
  VALUES ('create_employee', 'employees', v_new_employee_uuid, p_data);

  -- Return complete employee data
  RETURN jsonb_build_object(
    'success', true,
    'employee_id', v_employee_id,
    'id', v_new_employee_uuid,
    'license_id', v_license_id,
    'status', 'inactive',
    'message', 'Employee created with inactive status. Send activation email to enable portal access.'
  );

EXCEPTION 
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee ID, email or phone already exists');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: create_google_oauth_customer(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_google_oauth_customer(p_auth_user_id uuid, p_email text, p_name text, p_phone text DEFAULT ''::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_customer_id uuid;
  v_existing_customer_id uuid;
  v_existing_employee_id uuid;
  v_phone_value text;
BEGIN
  -- Normalize email
  p_email := lower(trim(p_email));
  
  -- Normalize phone: treat empty/whitespace-only as NULL to avoid unique constraint violations
  v_phone_value := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  
  -- Check if email already exists as an employee (should NOT allow registration)
  SELECT id INTO v_existing_employee_id
  FROM employees
  WHERE lower(email) = p_email
  LIMIT 1;
  
  IF v_existing_employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'This email is registered as an employee. Please use your employee credentials.';
  END IF;
  
  -- Check if customer already exists with this email
  SELECT id INTO v_existing_customer_id
  FROM customers
  WHERE lower(email) = p_email
  LIMIT 1;
  
  IF v_existing_customer_id IS NOT NULL THEN
    -- Link the auth_user_id to existing customer if not already linked
    UPDATE customers
    SET auth_user_id = p_auth_user_id,
        updated_at = now()
    WHERE id = v_existing_customer_id
      AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id);
    
    RETURN v_existing_customer_id;
  END IF;
  
  -- Check if auth_user_id already linked to another customer
  SELECT id INTO v_existing_customer_id
  FROM customers
  WHERE auth_user_id = p_auth_user_id
  LIMIT 1;
  
  IF v_existing_customer_id IS NOT NULL THEN
    RETURN v_existing_customer_id;
  END IF;
  
  -- Create new customer (phone is NULL for Google OAuth to avoid unique constraint)
  INSERT INTO customers (
    email,
    name,
    phone,
    auth_user_id,
    is_verified,
    created_at,
    updated_at
  )
  VALUES (
    p_email,
    COALESCE(NULLIF(p_name, ''), split_part(p_email, '@', 1)),
    v_phone_value,  -- NULL instead of '' to avoid unique constraint violation
    p_auth_user_id,
    true,  -- Google OAuth users are auto-verified
    now(),
    now()
  )
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$;


--
-- Name: FUNCTION create_google_oauth_customer(p_auth_user_id uuid, p_email text, p_name text, p_phone text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_google_oauth_customer(p_auth_user_id uuid, p_email text, p_name text, p_phone text) IS 'Creates a new customer from Google OAuth. Only for customers, not employees.';


--
-- Name: create_inventory_item(text, text, text, text, numeric, numeric, numeric, numeric, text, text, text, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_inventory_item(p_name text, p_sku text DEFAULT NULL::text, p_category text DEFAULT 'other'::text, p_unit text DEFAULT 'pcs'::text, p_quantity numeric DEFAULT 0, p_min_quantity numeric DEFAULT 10, p_max_quantity numeric DEFAULT 100, p_cost_per_unit numeric DEFAULT 0, p_supplier text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_expiry_date date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    new_item_id UUID;
    generated_sku TEXT;
BEGIN
    -- Get employee ID (allow null for unauthenticated scenarios)
    emp_id := get_employee_id();
    
    -- Generate SKU if not provided
    IF p_sku IS NULL OR p_sku = '' THEN
        generated_sku := UPPER(LEFT(REPLACE(p_name, ' ', ''), 3)) || '-' || TO_CHAR(NOW(), 'YYMMDDHH24MI');
    ELSE
        generated_sku := p_sku;
    END IF;
    
    -- Check for duplicate SKU
    IF EXISTS (SELECT 1 FROM inventory WHERE sku = generated_sku) THEN
        RETURN json_build_object('success', false, 'error', 'SKU already exists');
    END IF;
    
    INSERT INTO inventory (
        name, sku, category, unit, quantity, min_quantity, max_quantity,
        cost_per_unit, supplier, notes, location, barcode, expiry_date,
        is_active, created_by, created_at, updated_at
    ) VALUES (
        p_name, generated_sku, p_category, p_unit, p_quantity, p_min_quantity, p_max_quantity,
        p_cost_per_unit, p_supplier, p_notes, p_location, p_barcode, p_expiry_date,
        true, emp_id, NOW(), NOW()
    ) RETURNING id INTO new_item_id;
    
    -- Log initial stock transaction if quantity > 0
    IF p_quantity > 0 THEN
        INSERT INTO inventory_transactions (
            inventory_id, transaction_type, quantity_change,
            unit_cost, total_cost, notes, created_by, created_at
        ) VALUES (
            new_item_id, 'initial', p_quantity,
            p_cost_per_unit, p_quantity * p_cost_per_unit,
            'Initial stock entry', emp_id, NOW()
        );
    END IF;
    
    RETURN json_build_object('success', true, 'id', new_item_id, 'sku', generated_sku);
END;
$$;


--
-- Name: create_inventory_supplier(text, text, text, text, text, text, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_inventory_supplier(p_name text, p_contact_person text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_payment_terms text DEFAULT NULL::text, p_lead_time_days integer DEFAULT 7, p_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO inventory_suppliers (
        name, contact_person, email, phone, address, city,
        payment_terms, lead_time_days, notes
    ) VALUES (
        p_name, p_contact_person, p_email, p_phone, p_address, p_city,
        p_payment_terms, p_lead_time_days, p_notes
    ) RETURNING id INTO new_id;
    
    RETURN json_build_object('success', true, 'id', new_id);
END;
$$;


--
-- Name: create_leave_request(character varying, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_leave_request(p_leave_type character varying, p_start_date date, p_end_date date, p_reason text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  emp_id UUID;
  emp_status VARCHAR;
  total_days INTEGER;
  balance_record RECORD;
  leave_available INTEGER;
  new_request RECORD;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check employee status
  SELECT status INTO emp_status FROM employees WHERE id = emp_id;
  IF emp_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Your account is not active');
  END IF;
  
  -- Validate dates
  IF p_start_date < CURRENT_DATE THEN
    RETURN json_build_object('success', false, 'error', 'Start date cannot be in the past');
  END IF;
  
  IF p_end_date < p_start_date THEN
    RETURN json_build_object('success', false, 'error', 'End date must be after start date');
  END IF;
  
  -- Calculate total days (excluding weekends optionally)
  total_days := (p_end_date - p_start_date) + 1;
  
  -- Check for overlapping requests
  IF EXISTS (
    SELECT 1 FROM leave_requests
    WHERE employee_id = emp_id
    AND status IN ('pending', 'approved')
    AND (
      (p_start_date BETWEEN start_date AND end_date)
      OR (p_end_date BETWEEN start_date AND end_date)
      OR (start_date BETWEEN p_start_date AND p_end_date)
    )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You have an overlapping leave request');
  END IF;
  
  -- Check leave balance for certain types
  IF p_leave_type IN ('annual', 'sick', 'casual') THEN
    SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
    
    IF balance_record IS NULL THEN
      -- Create default balance
      INSERT INTO leave_balances (employee_id) VALUES (emp_id)
      RETURNING * INTO balance_record;
    END IF;
    
    -- Check available balance
    CASE p_leave_type
      WHEN 'annual' THEN leave_available := balance_record.annual_leave - balance_record.annual_used;
      WHEN 'sick' THEN leave_available := balance_record.sick_leave - balance_record.sick_used;
      WHEN 'casual' THEN leave_available := balance_record.casual_leave - balance_record.casual_used;
      ELSE leave_available := 999;
    END CASE;
    
    IF total_days > leave_available THEN
      RETURN json_build_object(
        'success', false, 
        'error', format('Insufficient %s leave balance. Available: %s days', p_leave_type, leave_available)
      );
    END IF;
  END IF;
  
  -- Create the request
  INSERT INTO leave_requests (
    employee_id,
    leave_type,
    start_date,
    end_date,
    total_days,
    reason,
    status
  ) VALUES (
    emp_id,
    p_leave_type,
    p_start_date,
    p_end_date,
    total_days,
    p_reason,
    'pending'
  )
  RETURNING * INTO new_request;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Leave request submitted successfully',
    'request', row_to_json(new_request)
  );
END;
$$;


--
-- Name: FUNCTION create_leave_request(p_leave_type character varying, p_start_date date, p_end_date date, p_reason text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_leave_request(p_leave_type character varying, p_start_date date, p_end_date date, p_reason text) IS 'Create a new leave request - for employees';


--
-- Name: create_leave_request(uuid, character varying, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_leave_request(p_employee_id uuid, p_leave_type character varying, p_start_date date, p_end_date date, p_reason text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  emp_id UUID;
  emp_status VARCHAR;
  total_days INTEGER;
  balance_record RECORD;
  leave_available INTEGER;
  new_request RECORD;
BEGIN
  emp_id := resolve_employee_id(p_employee_id);
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  
  SELECT status INTO emp_status FROM employees WHERE id = emp_id;
  IF emp_status != 'active' THEN RETURN json_build_object('success', false, 'error', 'Your account is not active'); END IF;
  IF p_start_date < CURRENT_DATE THEN RETURN json_build_object('success', false, 'error', 'Start date cannot be in the past'); END IF;
  IF p_end_date < p_start_date THEN RETURN json_build_object('success', false, 'error', 'End date must be after start date'); END IF;
  
  total_days := (p_end_date - p_start_date) + 1;
  
  IF EXISTS (
    SELECT 1 FROM leave_requests WHERE employee_id = emp_id AND status IN ('pending', 'approved')
    AND ((p_start_date BETWEEN start_date AND end_date) OR (p_end_date BETWEEN start_date AND end_date) OR (start_date BETWEEN p_start_date AND p_end_date))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You have an overlapping leave request');
  END IF;
  
  IF p_leave_type IN ('annual', 'sick', 'casual') THEN
    SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
    IF balance_record IS NULL THEN
      INSERT INTO leave_balances (employee_id) VALUES (emp_id) RETURNING * INTO balance_record;
    END IF;
    CASE p_leave_type
      WHEN 'annual' THEN leave_available := balance_record.annual_leave - balance_record.annual_used;
      WHEN 'sick' THEN leave_available := balance_record.sick_leave - balance_record.sick_used;
      WHEN 'casual' THEN leave_available := balance_record.casual_leave - balance_record.casual_used;
      ELSE leave_available := 999;
    END CASE;
    IF total_days > leave_available THEN
      RETURN json_build_object('success', false, 'error', format('Insufficient %s leave balance. Available: %s days', p_leave_type, leave_available));
    END IF;
  END IF;
  
  INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, reason, status)
  VALUES (emp_id, p_leave_type, p_start_date, p_end_date, total_days, p_reason, 'pending')
  RETURNING * INTO new_request;
  
  RETURN json_build_object('success', true, 'message', 'Leave request submitted successfully', 'request', row_to_json(new_request));
END;
$$;


--
-- Name: create_menu_category(text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_menu_category(p_name text, p_slug text, p_description text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_display_order integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    INSERT INTO menu_categories (name, slug, description, image_url, display_order)
    VALUES (p_name, p_slug, p_description, p_image_url, p_display_order)
    RETURNING jsonb_build_object(
        'id', id,
        'name', name,
        'slug', slug,
        'description', description,
        'image_url', image_url,
        'created_at', created_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


--
-- Name: create_menu_item(uuid, text, text, numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_menu_item(p_category_id uuid, p_name text, p_description text, p_price numeric, p_images jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
    v_slug TEXT;
BEGIN
    -- Generate slug from name
    v_slug := generate_slug(p_name);
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM menu_items WHERE slug = v_slug) LOOP
        v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
    END LOOP;
    
    INSERT INTO menu_items (category_id, name, slug, description, price, images)
    VALUES (p_category_id, p_name, v_slug, p_description, p_price, p_images)
    RETURNING jsonb_build_object(
        'id', id,
        'name', name,
        'slug', slug,
        'price', price,
        'is_available', is_available,
        'created_at', created_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


--
-- Name: create_menu_item_advanced(uuid, text, text, numeric, text[], boolean, boolean, boolean, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_menu_item_advanced(p_category_id uuid, p_name text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT 0, p_images text[] DEFAULT ARRAY[]::text[], p_is_available boolean DEFAULT true, p_is_featured boolean DEFAULT false, p_is_spicy boolean DEFAULT false, p_is_vegetarian boolean DEFAULT false, p_preparation_time integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
        images, is_available, is_featured, is_spicy, is_vegetarian, preparation_time
    )
    VALUES (
        p_category_id, trim(p_name), v_slug, p_description, p_price,
        p_images, p_is_available, p_is_featured, p_is_spicy, p_is_vegetarian, p_preparation_time
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
$$;


--
-- Name: create_menu_item_advanced(uuid, text, text, numeric, text[], boolean, boolean, integer, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_menu_item_advanced(p_category_id uuid, p_name text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT 0, p_images text[] DEFAULT ARRAY[]::text[], p_is_available boolean DEFAULT true, p_is_featured boolean DEFAULT false, p_preparation_time integer DEFAULT NULL::integer, p_has_variants boolean DEFAULT false, p_size_variants jsonb DEFAULT NULL::jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: create_menu_item_advanced(uuid, text, text, numeric, numeric, text[], boolean, boolean, boolean, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_menu_item_advanced(p_category_id uuid, p_name text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT 0, p_sale_price numeric DEFAULT NULL::numeric, p_images text[] DEFAULT ARRAY[]::text[], p_is_available boolean DEFAULT true, p_is_featured boolean DEFAULT false, p_is_spicy boolean DEFAULT false, p_is_vegetarian boolean DEFAULT false, p_preparation_time integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
        category_id, name, slug, description, price, sale_price,
        images, is_available, is_featured, is_spicy, is_vegetarian, preparation_time
    )
    VALUES (
        p_category_id, trim(p_name), v_slug, p_description, p_price, p_sale_price,
        p_images, p_is_available, p_is_featured, p_is_spicy, p_is_vegetarian, p_preparation_time
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
$$;


--
-- Name: create_notification(uuid, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_user_id uuid, p_user_type text, p_title text, p_message text, p_type text DEFAULT 'system'::text, p_data jsonb DEFAULT NULL::jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    VALUES (p_user_id, p_user_type, p_title, p_message, p_type, p_data)
    RETURNING id INTO new_id;
    
    RETURN json_build_object('success', true, 'id', new_id);
END;
$$;


--
-- Name: create_order_with_items(uuid, public.order_type, public.payment_method, text, uuid, jsonb, numeric, numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_order_with_items(p_customer_id uuid, p_order_type public.order_type, p_payment_method public.payment_method, p_delivery_address text, p_table_id uuid, p_items jsonb, p_subtotal numeric, p_tax numeric, p_delivery_fee numeric, p_discount numeric, p_total numeric) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_order_id UUID;
BEGIN
    -- Insert order
    INSERT INTO orders (
        customer_id, order_type, payment_method, delivery_address,
        table_id, items, subtotal, tax, delivery_fee, discount, total
    ) VALUES (
        p_customer_id, p_order_type, p_payment_method, p_delivery_address,
        p_table_id, p_items, p_subtotal, p_tax, p_delivery_fee, p_discount, p_total
    ) RETURNING id INTO v_order_id;
    
    -- Create initial status history
    INSERT INTO order_status_history (order_id, status, notes)
    VALUES (v_order_id, 'pending', 'Order created');
    
    -- Create notification for customer
    INSERT INTO notifications (user_type, user_id, title, message, type)
    VALUES ('customer', p_customer_id, 'Order Placed', 'Your order has been placed successfully', 'order');
    
    RETURN v_order_id;
END;
$$;


--
-- Name: create_payment_method(text, text, text, text, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_payment_method(p_method_type text, p_method_name text, p_account_number text, p_account_holder_name text, p_bank_name text DEFAULT NULL::text, p_is_active boolean DEFAULT true, p_display_order integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_new_id UUID;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Validate method type
    IF p_method_type NOT IN ('jazzcash', 'easypaisa', 'bank') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid method type. Must be jazzcash, easypaisa, or bank');
    END IF;
    
    -- Validate required fields
    IF p_method_name IS NULL OR TRIM(p_method_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Method name is required');
    END IF;
    
    IF p_account_number IS NULL OR TRIM(p_account_number) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Account number is required');
    END IF;
    
    IF p_account_holder_name IS NULL OR TRIM(p_account_holder_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Account holder name is required');
    END IF;
    
    -- Bank name required for bank type
    IF p_method_type = 'bank' AND (p_bank_name IS NULL OR TRIM(p_bank_name) = '') THEN
        RETURN json_build_object('success', false, 'error', 'Bank name is required for bank accounts');
    END IF;
    
    -- Insert new payment method
    INSERT INTO payment_methods (
        method_type,
        method_name,
        account_number,
        account_holder_name,
        bank_name,
        is_active,
        display_order
    ) VALUES (
        p_method_type,
        TRIM(p_method_name),
        TRIM(p_account_number),
        TRIM(p_account_holder_name),
        NULLIF(TRIM(p_bank_name), ''),
        p_is_active,
        p_display_order
    )
    RETURNING id INTO v_new_id;
    
    RETURN json_build_object(
        'success', true,
        'id', v_new_id,
        'message', 'Payment method created successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;


--
-- Name: FUNCTION create_payment_method(p_method_type text, p_method_name text, p_account_number text, p_account_holder_name text, p_bank_name text, p_is_active boolean, p_display_order integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_payment_method(p_method_type text, p_method_name text, p_account_number text, p_account_holder_name text, p_bank_name text, p_is_active boolean, p_display_order integer) IS 'Admin: Create a new payment method';


--
-- Name: create_payment_method_internal(text, text, text, text, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_payment_method_internal(p_method_type text, p_method_name text, p_account_number text, p_account_holder_name text, p_bank_name text DEFAULT NULL::text, p_is_active boolean DEFAULT true, p_display_order integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_new_id UUID;
BEGIN
    IF p_method_type NOT IN ('jazzcash', 'easypaisa', 'bank') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid method type');
    END IF;
    
    INSERT INTO payment_methods (method_type, method_name, account_number, account_holder_name, bank_name, is_active, display_order)
    VALUES (p_method_type, p_method_name, p_account_number, p_account_holder_name, p_bank_name, p_is_active, p_display_order)
    RETURNING id INTO v_new_id;
    
    RETURN json_build_object('success', true, 'id', v_new_id, 'message', 'Payment method created');
END;
$$;


--
-- Name: create_payslip(uuid, date, date, numeric, numeric, numeric, numeric, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_payslip(p_employee_id uuid, p_period_start date, p_period_end date, p_base_salary numeric, p_overtime_hours numeric DEFAULT 0, p_overtime_rate numeric DEFAULT 1.5, p_bonuses numeric DEFAULT 0, p_deductions numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0, p_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    new_id UUID;
    net_salary DECIMAL;
    overtime_pay DECIMAL;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    -- Calculate net salary
    overtime_pay := (p_base_salary / 30 / 8) * p_overtime_hours * p_overtime_rate;
    net_salary := p_base_salary + overtime_pay + p_bonuses - p_deductions - p_tax_amount;
    
    INSERT INTO payslips (
        employee_id, period_start, period_end, base_salary,
        overtime_hours, overtime_rate, bonuses, deductions,
        tax_amount, net_salary, notes, created_by
    ) VALUES (
        p_employee_id, p_period_start, p_period_end, p_base_salary,
        p_overtime_hours, p_overtime_rate, p_bonuses, p_deductions,
        p_tax_amount, net_salary, p_notes, emp_id
    )
    RETURNING id INTO new_id;
    
    RETURN json_build_object(
        'success', true,
        'id', new_id,
        'net_salary', net_salary
    );
END;
$$;


--
-- Name: create_payslip_advanced(uuid, date, date, numeric, numeric, numeric, numeric, numeric, numeric, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_payslip_advanced(p_employee_id uuid, p_period_start date, p_period_end date, p_base_salary numeric, p_overtime_hours numeric DEFAULT 0, p_overtime_rate numeric DEFAULT 1.5, p_bonuses numeric DEFAULT 0, p_deductions numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0, p_payment_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_id UUID;
    v_net_salary DECIMAL;
    v_overtime_pay DECIMAL;
    v_emp_name TEXT;
BEGIN
    -- Validate employee exists
    SELECT name INTO v_emp_name FROM employees WHERE id = p_employee_id AND status = 'active';
    IF v_emp_name IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Employee not found or inactive');
    END IF;

    -- Calculate net salary
    v_overtime_pay := (p_base_salary / 30.0 / 8.0) * p_overtime_hours * p_overtime_rate;
    v_net_salary := p_base_salary + v_overtime_pay + p_bonuses - p_deductions - p_tax_amount;
    
    -- Insert new payslip
    INSERT INTO payslips (
        employee_id, period_start, period_end, base_salary,
        overtime_hours, overtime_rate, bonuses, deductions,
        tax_amount, net_salary, status, payment_method, notes, created_by
    ) VALUES (
        p_employee_id, p_period_start, p_period_end, p_base_salary,
        p_overtime_hours, p_overtime_rate, p_bonuses, p_deductions,
        p_tax_amount, v_net_salary, 'pending', p_payment_method, p_notes, p_created_by
    )
    RETURNING id INTO new_id;
    
    RETURN json_build_object(
        'success', true,
        'id', new_id,
        'net_salary', v_net_salary,
        'employee_name', v_emp_name
    );
END;
$$;


--
-- Name: create_portal_order(json); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_portal_order(p_order_data json) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
    v_table_ids UUID[];
    v_table_number INT;
    v_table_numbers TEXT := '';
    v_order_type TEXT;
    v_items JSON;
    v_item RECORD;
    v_subtotal NUMERIC := 0;
    v_tax NUMERIC := 0;
    v_total NUMERIC := 0;
    v_notes TEXT;
    v_employee_id UUID;
    v_employee_name TEXT;
    v_loyalty_points_earned INT := 0;
    v_tid UUID;
    v_item_count INT := 0;
    v_total_quantity INT := 0;
BEGIN
    -- Extract order data
    v_customer_type := COALESCE(p_order_data->>'customer_type', 'walk-in');
    v_customer_name := p_order_data->>'customer_name';
    v_customer_phone := COALESCE(NULLIF(p_order_data->>'customer_phone', ''), '0000000000');
    v_customer_email := NULLIF(p_order_data->>'customer_email', '');
    v_customer_address := NULLIF(p_order_data->>'customer_address', '');
    v_customer_id := NULLIF(p_order_data->>'customer_id', '')::UUID;
    v_table_id := NULLIF(p_order_data->>'table_id', '')::UUID;
    v_order_type := COALESCE(p_order_data->>'order_type', 'walk-in');
    v_items := p_order_data->'items';
    v_notes := NULLIF(p_order_data->>'notes', '');
    v_employee_id := NULLIF(p_order_data->>'employee_id', '')::UUID;

    -- Parse table_ids array if provided (for multi-table support)
    -- Use text comparison since JSON doesn't support != operator
    IF p_order_data->>'table_ids' IS NOT NULL 
       AND p_order_data->>'table_ids' != 'null' 
       AND p_order_data->>'table_ids' != '[]' THEN
        SELECT array_agg(elem::text::uuid)
        INTO v_table_ids
        FROM json_array_elements_text(p_order_data->'table_ids') elem;
    ELSIF v_table_id IS NOT NULL THEN
        v_table_ids := ARRAY[v_table_id];
    END IF;

    -- Get employee name for record keeping
    IF v_employee_id IS NOT NULL THEN
        SELECT name INTO v_employee_name FROM employees WHERE id = v_employee_id;
    END IF;

    -- Get table numbers for all selected tables
    IF v_table_ids IS NOT NULL AND array_length(v_table_ids, 1) > 0 THEN
        SELECT string_agg(table_number::text, ', ' ORDER BY table_number)
        INTO v_table_numbers
        FROM restaurant_tables
        WHERE id = ANY(v_table_ids);
        
        -- Get first table number for the order
        SELECT table_number INTO v_table_number 
        FROM restaurant_tables 
        WHERE id = v_table_ids[1];
    END IF;

    -- Validate customer name
    IF v_customer_name IS NULL OR TRIM(v_customer_name) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Customer name is required'
        );
    END IF;

    -- Validate items
    IF v_items IS NULL OR json_array_length(v_items) = 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Order must have at least one item'
        );
    END IF;

    -- Generate order number with better format
    SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
           LPAD(COALESCE(
               (SELECT COUNT(*)::INT + 1 
                FROM orders 
                WHERE DATE(created_at) = CURRENT_DATE), 
               1
           )::TEXT, 4, '0')
    INTO v_order_number;

    -- Calculate totals from items and count
    v_item_count := json_array_length(v_items);
    FOR v_item IN SELECT * FROM json_array_elements(v_items)
    LOOP
        v_subtotal := v_subtotal + (
            COALESCE((v_item.value->>'price')::NUMERIC, 0) * 
            COALESCE((v_item.value->>'quantity')::INT, 1)
        );
        v_total_quantity := v_total_quantity + COALESCE((v_item.value->>'quantity')::INT, 1);
    END LOOP;

    -- Calculate tax (16% GST)
    v_tax := ROUND(v_subtotal * 0.16, 2);
    v_total := v_subtotal + v_tax;

    -- Calculate loyalty points (1 point per 100 spent)
    v_loyalty_points_earned := FLOOR(v_total / 100);

    -- Generate order ID
    v_order_id := gen_random_uuid();

    -- Create the order with full details
    -- Status is determined by order type:
    -- - Online orders: 'pending' (need manual confirmation before kitchen)
    -- - Dine-in/Takeaway/Walk-in: 'preparing' (directly in kitchen, ready to prepare)
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
        v_order_id,
        v_order_number,
        v_customer_id,
        TRIM(v_customer_name),
        v_customer_phone,
        v_customer_email,
        v_customer_address,
        v_order_type::order_type,
        v_table_number,
        CASE 
            WHEN v_order_type = 'online' THEN 'pending'::order_status 
            ELSE 'preparing'::order_status  -- Dine-in, takeaway, walk-in go directly to kitchen
        END,
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
    );

    -- Update ALL selected tables status if dine-in
    IF v_table_ids IS NOT NULL AND array_length(v_table_ids, 1) > 0 THEN
        FOREACH v_tid IN ARRAY v_table_ids
        LOOP
            UPDATE restaurant_tables 
            SET status = 'occupied',
                current_order_id = v_order_id,
                updated_at = NOW()
            WHERE id = v_tid;
        END LOOP;
    END IF;

    -- =============================================
    -- REGISTERED CUSTOMER HISTORY TRACKING
    -- =============================================
    IF v_customer_id IS NOT NULL THEN
        -- Add loyalty points
        IF v_loyalty_points_earned > 0 THEN
            INSERT INTO loyalty_points (
                id,
                customer_id, 
                order_id, 
                points, 
                type, 
                description, 
                created_at
            ) VALUES (
                gen_random_uuid(),
                v_customer_id, 
                v_order_id, 
                v_loyalty_points_earned, 
                'earned', 
                'Points earned from order ' || v_order_number || ' (Rs. ' || v_total::text || ')', 
                NOW()
            );
        END IF;

        -- Update customer's last order info and stats (if columns exist)
        UPDATE customers
        SET 
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;

    -- =============================================
    -- BUSINESS RECORD KEEPING - Order Activity Log
    -- Store detailed order creation log for business analytics
    -- =============================================
    BEGIN
        INSERT INTO order_activity_log (
            id,
            order_id,
            action,
            action_by,
            action_by_name,
            details,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_order_id,
            'created',
            v_employee_id,
            v_employee_name,
            json_build_object(
                'order_number', v_order_number,
                'customer_type', v_customer_type,
                'customer_id', v_customer_id,
                'customer_name', v_customer_name,
                'customer_phone', v_customer_phone,
                'customer_email', v_customer_email,
                'order_type', v_order_type,
                'table_numbers', v_table_numbers,
                'item_count', v_item_count,
                'total_quantity', v_total_quantity,
                'subtotal', v_subtotal,
                'tax', v_tax,
                'total', v_total,
                'loyalty_points_earned', v_loyalty_points_earned,
                'created_via', 'portal'
            ),
            NOW()
        );
    EXCEPTION WHEN undefined_table THEN
        -- order_activity_log table doesn't exist, skip
        NULL;
    END;

    -- Return success with comprehensive details
    RETURN json_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'customer_id', v_customer_id,
        'customer_type', v_customer_type,
        'customer_name', v_customer_name,
        'order_type', v_order_type,
        'table_numbers', v_table_numbers,
        'item_count', v_item_count,
        'total_quantity', v_total_quantity,
        'subtotal', v_subtotal,
        'tax', v_tax,
        'total', v_total,
        'loyalty_points_earned', v_loyalty_points_earned,
        'employee_name', v_employee_name,
        'message', 'Order created successfully'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;


--
-- Name: FUNCTION create_portal_order(p_order_data json); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_portal_order(p_order_data json) IS 'Create order with full customer history tracking and business record keeping. Supports multi-table selection.';


--
-- Name: create_table(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_table(p_table_number integer, p_capacity integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    INSERT INTO restaurant_tables (table_number, capacity)
    VALUES (p_table_number, p_capacity)
    RETURNING jsonb_build_object(
        'id', id,
        'table_number', table_number,
        'capacity', capacity,
        'status', status
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


--
-- Name: create_waiter_dine_in_order(uuid, jsonb, integer, uuid, text, text, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_waiter_dine_in_order(p_table_id uuid, p_items jsonb, p_customer_count integer DEFAULT 1, p_customer_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT NULL::text, p_customer_phone text DEFAULT NULL::text, p_customer_email text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_payment_method text DEFAULT 'cash'::text, p_send_email boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_waiter_id UUID;
    v_waiter_record RECORD;
    v_table_record RECORD;
    v_customer_record RECORD;
    v_new_order_id UUID;
    v_order_number TEXT;
    v_invoice_number TEXT;
    v_subtotal DECIMAL(10, 2);
    v_tax DECIMAL(10, 2);
    v_total DECIMAL(10, 2);
    v_total_items INT;
    v_history_id UUID;
    v_is_registered BOOLEAN := false;
BEGIN
    -- Get current waiter
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Validate waiter
    SELECT * INTO v_waiter_record FROM employees 
    WHERE id = v_waiter_id 
      AND role IN ('waiter', 'admin', 'manager')
      AND status = 'active';
    
    IF v_waiter_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized as waiter');
    END IF;
    
    -- Get table
    SELECT * INTO v_table_record FROM restaurant_tables 
    WHERE id = p_table_id
    FOR UPDATE;
    
    IF v_table_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    -- Validate table is assigned to this waiter or available
    IF v_table_record.assigned_waiter_id IS NOT NULL 
       AND v_table_record.assigned_waiter_id != v_waiter_id THEN
        RETURN json_build_object('success', false, 'error', 'Table is assigned to another waiter');
    END IF;
    
    -- If customer details provided, look up registered customer
    IF p_customer_phone IS NOT NULL OR p_customer_email IS NOT NULL THEN
        SELECT * INTO v_customer_record FROM customers
        WHERE 
            (p_customer_phone IS NOT NULL AND phone = p_customer_phone) OR
            (p_customer_email IS NOT NULL AND email = p_customer_email)
        LIMIT 1;
        
        IF v_customer_record IS NOT NULL THEN
            v_is_registered := true;
            -- Use registered customer details
            p_customer_id := v_customer_record.id;
            p_customer_name := COALESCE(p_customer_name, v_customer_record.name);
            p_customer_email := COALESCE(p_customer_email, v_customer_record.email);
            p_customer_phone := COALESCE(p_customer_phone, v_customer_record.phone);
        END IF;
    END IF;
    
    -- Calculate totals
    SELECT 
        COALESCE(SUM((item->>'price')::DECIMAL * (item->>'quantity')::INT), 0),
        COALESCE(SUM((item->>'quantity')::INT), 0)
    INTO v_subtotal, v_total_items
    FROM jsonb_array_elements(p_items) AS item;
    
    v_tax := ROUND(v_subtotal * 0.05, 2); -- 5% tax
    v_total := v_subtotal + v_tax;
    
    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD((SELECT COUNT(*) + 1 FROM orders WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 4, '0');
    
    -- Create order
    INSERT INTO orders (
        customer_id, customer_name, customer_phone, customer_email,
        order_type, status, items, 
        subtotal, tax, total,
        payment_method, payment_status,
        table_number, notes,
        waiter_id, assigned_to,
        can_cancel_until
    ) VALUES (
        p_customer_id,
        COALESCE(p_customer_name, 'Walk-in Customer'),
        p_customer_phone,
        p_customer_email,
        'dine-in',
        'confirmed',
        p_items,
        v_subtotal,
        v_tax,
        v_total,
        p_payment_method,
        CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'paid' END,
        v_table_record.table_number,
        p_notes,
        v_waiter_id,
        v_waiter_id,
        NOW() + INTERVAL '5 minutes'
    )
    RETURNING id, order_number INTO v_new_order_id, v_order_number;
    
    -- Update table
    UPDATE restaurant_tables
    SET 
        status = 'occupied',
        current_order_id = v_new_order_id,
        current_customers = p_customer_count,
        assigned_waiter_id = v_waiter_id,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    -- Insert into waiter history
    INSERT INTO waiter_order_history (
        waiter_id, order_id, order_number,
        table_id, table_number,
        customer_id, customer_name, customer_phone, customer_email, customer_count,
        is_registered_customer,
        items, total_items, subtotal, tax, total,
        payment_method, payment_status,
        invoice_number,
        order_status, order_confirmed_at
    ) VALUES (
        v_waiter_id, v_new_order_id, v_order_number,
        p_table_id, v_table_record.table_number,
        p_customer_id, p_customer_name, p_customer_phone, p_customer_email, p_customer_count,
        v_is_registered,
        p_items, v_total_items, v_subtotal, v_tax, v_total,
        p_payment_method, CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'paid' END,
        v_invoice_number,
        'confirmed', NOW()
    )
    RETURNING id INTO v_history_id;
    
    -- Insert into table_history if exists
    BEGIN
        INSERT INTO table_history (table_id, order_id, waiter_id, customer_count, opened_at)
        VALUES (p_table_id, v_new_order_id, v_waiter_id, p_customer_count, NOW());
    EXCEPTION WHEN undefined_table THEN
        NULL; -- Table history doesn't exist, skip
    END;
    
    -- Add to order status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (v_new_order_id, 'confirmed'::order_status, v_waiter_id, 'Order created by waiter');
    
    -- Update employee stats
    UPDATE employees
    SET 
        total_orders_taken = COALESCE(total_orders_taken, 0) + 1,
        updated_at = NOW()
    WHERE id = v_waiter_id;
    
    -- Update customer stats if registered
    IF v_is_registered AND p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET 
            total_orders = COALESCE(total_orders, 0) + 1,
            total_spent = COALESCE(total_spent, 0) + v_total,
            loyalty_points = COALESCE(loyalty_points, 0) + FLOOR(v_total / 10),
            updated_at = NOW()
        WHERE id = p_customer_id;
    END IF;
    
    -- Create notification for kitchen
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    SELECT 
        e.id, 'employee', 'New Dine-in Order',
        'Order #' || v_order_number || ' - Table ' || v_table_record.table_number,
        'order',
        jsonb_build_object(
            'order_id', v_new_order_id,
            'order_number', v_order_number,
            'table_number', v_table_record.table_number,
            'items_count', v_total_items
        )
    FROM employees e
    WHERE e.role IN ('kitchen_staff', 'admin', 'manager')
      AND e.status = 'active'
      AND e.portal_enabled = true;
    
    -- Return success
    RETURN json_build_object(
        'success', true,
        'order_id', v_new_order_id,
        'order_number', v_order_number,
        'invoice_number', v_invoice_number,
        'history_id', v_history_id,
        'table', json_build_object(
            'id', p_table_id,
            'table_number', v_table_record.table_number
        ),
        'customer', json_build_object(
            'id', p_customer_id,
            'name', p_customer_name,
            'email', p_customer_email,
            'phone', p_customer_phone,
            'is_registered', v_is_registered
        ),
        'order', json_build_object(
            'subtotal', v_subtotal,
            'tax', v_tax,
            'total', v_total,
            'items_count', v_total_items,
            'payment_method', p_payment_method
        ),
        'send_email', p_send_email AND p_customer_email IS NOT NULL,
        'created_at', NOW()
    );
END;
$$;


--
-- Name: FUNCTION create_waiter_dine_in_order(p_table_id uuid, p_items jsonb, p_customer_count integer, p_customer_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text, p_notes text, p_payment_method text, p_send_email boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_waiter_dine_in_order(p_table_id uuid, p_items jsonb, p_customer_count integer, p_customer_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text, p_notes text, p_payment_method text, p_send_email boolean) IS 'Creates dine-in order with full tracking and customer lookup';


--
-- Name: deactivate_customer_promo_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deactivate_customer_promo_admin(p_promo_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE promo_codes
    SET is_active = false, updated_at = NOW()
    WHERE id = p_promo_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Promo code deactivated');
END;
$$;


--
-- Name: deduct_loyalty_points(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deduct_loyalty_points(p_customer_id uuid, p_order_id uuid, p_points integer, p_order_number text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO loyalty_points (
        customer_id,
        order_id,
        points,
        type,
        description,
        created_at
    ) VALUES (
        p_customer_id,
        p_order_id,
        -p_points, -- Negative for deduction
        'redeemed',
        'Redeemed ' || p_points || ' points for order ' || p_order_number,
        NOW()
    );
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


--
-- Name: FUNCTION deduct_loyalty_points(p_customer_id uuid, p_order_id uuid, p_points integer, p_order_number text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.deduct_loyalty_points(p_customer_id uuid, p_order_id uuid, p_points integer, p_order_number text) IS 'Deducts loyalty points when redeemed for an order';


--
-- Name: delete_customer_promo_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_customer_promo_admin(p_promo_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM promo_codes
    WHERE id = p_promo_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Promo code deleted');
END;
$$;


--
-- Name: delete_customer_review(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_customer_review(p_customer_id uuid, p_review_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: delete_deal(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_deal(p_deal_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    DELETE FROM promo_code_usage WHERE promo_code_id = p_deal_id;
    DELETE FROM promo_codes WHERE id = p_deal_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: delete_deal_cascade(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_deal_cascade(p_deal_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM deals WHERE id = p_deal_id;
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: delete_deal_with_items(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_deal_with_items(p_deal_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM deals WHERE id = p_deal_id;
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: delete_employee(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_employee(p_employee_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE employees
    SET status = 'inactive', updated_at = NOW()
    WHERE id = p_employee_id;
    
    RETURN FOUND;
END;
$$;


--
-- Name: delete_employee_cascade(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_employee_cascade(p_employee_id uuid, p_deleted_by uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_employee_data JSONB;
  v_employee_name TEXT;
  v_documents_deleted INTEGER := 0;
  v_payroll_deleted INTEGER := 0;
  v_attendance_deleted INTEGER := 0;
BEGIN
  -- Get employee data for audit
  SELECT jsonb_build_object(
    'employee_id', employee_id,
    'name', name,
    'email', email,
    'role', role::TEXT
  ), name INTO v_employee_data, v_employee_name
  FROM employees WHERE id = p_employee_id;

  IF v_employee_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Delete documents
  DELETE FROM employee_documents WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_documents_deleted = ROW_COUNT;

  -- Delete payroll records
  DELETE FROM employee_payroll WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_payroll_deleted = ROW_COUNT;

  -- Delete attendance records
  DELETE FROM attendance WHERE employee_id = p_employee_id;
  GET DIAGNOSTICS v_attendance_deleted = ROW_COUNT;

  -- Delete licenses
  DELETE FROM employee_licenses WHERE employee_id = p_employee_id;

  -- Delete delivery history (set rider_id to null or delete)
  UPDATE delivery_history SET rider_id = NULL WHERE rider_id = p_employee_id;

  -- Finally delete employee
  DELETE FROM employees WHERE id = p_employee_id;

  -- Log deletion in audit
  INSERT INTO audit_logs (action, table_name, record_id, old_data, user_id)
  VALUES ('delete_employee', 'employees', p_employee_id, v_employee_data, p_deleted_by);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Employee "' || v_employee_name || '" deleted successfully',
    'deleted', jsonb_build_object(
      'documents', v_documents_deleted,
      'payroll_records', v_payroll_deleted,
      'attendance_records', v_attendance_deleted
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: delete_inventory_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_inventory_item(p_item_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Soft delete - just mark as inactive
    UPDATE inventory SET is_active = false, updated_at = NOW() WHERE id = p_item_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: delete_menu_category(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_menu_category(p_category_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM menu_categories WHERE id = p_category_id;
    RETURN FOUND;
END;
$$;


--
-- Name: delete_menu_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_menu_item(p_item_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_images JSONB;
    v_result JSONB;
BEGIN
    -- Get images before deleting
    SELECT images INTO v_images
    FROM menu_items
    WHERE id = p_item_id;
    
    -- Delete the menu item (SECURITY DEFINER bypasses RLS)
    DELETE FROM menu_items WHERE id = p_item_id;
    
    -- Return images for storage cleanup
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'images', COALESCE(v_images, '[]'::jsonb)
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'images', '[]'::jsonb
        );
    END IF;
END;
$$;


--
-- Name: FUNCTION delete_menu_item(p_item_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_menu_item(p_item_id uuid) IS 'Deletes a menu item and returns its images for storage cleanup. Uses SECURITY DEFINER to bypass RLS policies.';


--
-- Name: delete_payment_method(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_payment_method(p_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Check if payment method exists
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    -- Delete payment method
    DELETE FROM payment_methods WHERE id = p_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Payment method deleted successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;


--
-- Name: FUNCTION delete_payment_method(p_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_payment_method(p_id uuid) IS 'Admin: Delete a payment method';


--
-- Name: delete_payment_method_internal(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_payment_method_internal(p_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    DELETE FROM payment_methods WHERE id = p_id;
    RETURN json_build_object('success', true, 'message', 'Payment method deleted');
END;
$$;


--
-- Name: delete_payslip_advanced(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_payslip_advanced(p_payslip_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM payslips WHERE id = p_payslip_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Payslip not found');
    END IF;

    DELETE FROM payslips WHERE id = p_payslip_id;
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: delete_review(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_review(p_review_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    DELETE FROM reviews WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: delete_review_advanced(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_review_advanced(p_review_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: delete_review_by_employee(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_review_by_employee(p_review_id uuid, p_employee_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Check if employee exists and is admin only
    SELECT role INTO v_role 
    FROM employees 
    WHERE id = p_employee_id 
    AND status = 'active';
    
    IF v_role IS NULL OR v_role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized - admin only');
    END IF;
    
    DELETE FROM reviews WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: fix_customer_auth_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fix_customer_auth_user(p_customer_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_customer RECORD;
  v_auth_user RECORD;
  v_auth_user_id UUID;
  v_error_message TEXT;
BEGIN
  -- Get customer details
  SELECT id, auth_user_id, name, email, phone
  INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id;
  
  -- Check if customer exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;
  
  -- Check if auth user exists
  IF v_customer.auth_user_id IS NOT NULL THEN
    -- Cast to UUID safely
    BEGIN
      v_auth_user_id := v_customer.auth_user_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN json_build_object('success', false, 'error', 'Invalid auth user ID format');
    END;
    
    SELECT id INTO v_auth_user
    FROM auth.users
    WHERE id::text = v_auth_user_id::text
      AND deleted_at IS NULL;
    
    -- If auth user exists and is valid, no fix needed
    IF FOUND THEN
      RETURN json_build_object(
        'success', true,
        'message', 'Auth user is valid, no fix needed',
        'auth_user_id', v_customer.auth_user_id
      );
    END IF;
  END IF;
  
  -- At this point, either auth_user_id is null or points to invalid/deleted user
  RETURN json_build_object(
    'success', false,
    'error', 'Auth user is invalid. Please re-register or contact support.',
    'code', 'REQUIRES_REREGISTRATION',
    'customer_email', v_customer.email
  );
  
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to fix auth user: ' || v_error_message
    );
END;
$$;


--
-- Name: FUNCTION fix_customer_auth_user(p_customer_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fix_customer_auth_user(p_customer_id uuid) IS 'Checks and reports status of customer auth user reference';


--
-- Name: generate_advanced_invoice(uuid, text, numeric, numeric, numeric, text, integer, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_advanced_invoice(p_order_id uuid, p_payment_method text DEFAULT 'cash'::text, p_manual_discount numeric DEFAULT 0, p_tip numeric DEFAULT 0, p_service_charge numeric DEFAULT 0, p_promo_code text DEFAULT NULL::text, p_loyalty_points_used integer DEFAULT 0, p_notes text DEFAULT NULL::text, p_biller_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_employee_id UUID;
    v_order RECORD;
    v_customer RECORD;
    v_customer_found BOOLEAN := FALSE;
    v_customer_id UUID := NULL;
    v_customer_name TEXT := NULL;
    v_customer_phone TEXT := NULL;
    v_customer_email TEXT := NULL;
    v_customer_loyalty_points INT := 0;
    v_promo RECORD;
    v_promo_id UUID := NULL;
    v_promo_discount DECIMAL(10, 2) := 0;
    v_points_discount DECIMAL(10, 2) := 0;
    v_total_discount DECIMAL(10, 2) := 0;
    v_tax DECIMAL(10, 2);
    v_final_total DECIMAL(10, 2);
    v_points_earned INT := 0;
    v_new_invoice_id UUID;
    v_invoice_number TEXT;
    v_table_session_id UUID;
    v_brand_info JSONB;
    -- Reward promo code variables
    v_reward_promo_code TEXT := NULL;
    v_reward_promo_generated BOOLEAN := FALSE;
    v_total_customer_points INT := 0;
    -- Effective payment method (auto-detect online orders)
    v_effective_payment_method TEXT;
BEGIN
    -- Use explicitly passed biller_id first, then try auth lookup, then fallback
    IF p_biller_id IS NOT NULL THEN
        v_employee_id := p_biller_id;
    ELSE
        -- Try to get employee ID from auth (may be NULL if auth_user_id not set)
        v_employee_id := (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
        
        -- If no employee found by auth_user_id, try to get any active admin/manager
        IF v_employee_id IS NULL THEN
            v_employee_id := (
                SELECT id FROM employees 
                WHERE role::TEXT IN ('admin', 'manager') 
                AND status = 'active' 
                LIMIT 1
            );
        END IF;
    END IF;
    
    -- Get order with lock
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    
    IF v_order IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Check if invoice already exists
    IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
        RETURN json_build_object('success', false, 'error', 'Invoice already exists for this order');
    END IF;
    
    -- Determine effective payment method (auto-detect online orders by transaction_id)
    IF v_order.transaction_id IS NOT NULL THEN
        v_effective_payment_method := 'online';
    ELSE
        v_effective_payment_method := p_payment_method;
    END IF;
    
    -- Get customer if registered
    IF v_order.customer_id IS NOT NULL THEN
        SELECT c.*, 
               COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) as loyalty_points
        INTO v_customer
        FROM customers c
        WHERE c.id = v_order.customer_id;
        
        IF FOUND THEN
            v_customer_found := TRUE;
            v_customer_id := v_customer.id;
            v_customer_name := v_customer.name;
            v_customer_phone := v_customer.phone;
            v_customer_email := v_customer.email;
            v_customer_loyalty_points := COALESCE(v_customer.loyalty_points, 0);
        END IF;
    END IF;
    
    -- Validate and apply promo code
    IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        SELECT * INTO v_promo
        FROM promo_codes
        WHERE UPPER(code) = UPPER(p_promo_code)
        AND is_active = true
        AND valid_from <= NOW()
        AND valid_until >= NOW()
        AND (usage_limit IS NULL OR current_usage < usage_limit);
        
        IF FOUND THEN
            -- Store promo ID
            v_promo_id := v_promo.id;
            
            -- Calculate promo discount
            IF v_promo.promo_type = 'percentage' THEN
                v_promo_discount := ROUND(v_order.subtotal * (v_promo.value / 100), 2);
                IF v_promo.max_discount IS NOT NULL THEN
                    v_promo_discount := LEAST(v_promo_discount, v_promo.max_discount);
                END IF;
            ELSE
                v_promo_discount := LEAST(v_promo.value, v_order.subtotal);
            END IF;
            
            -- Update promo usage in promo_codes table
            UPDATE promo_codes
            SET current_usage = current_usage + 1,
                updated_at = NOW(),
                is_active = CASE WHEN usage_limit IS NOT NULL AND current_usage + 1 >= usage_limit THEN false ELSE is_active END
            WHERE id = v_promo.id;
            
            -- ALSO mark as used in customer_promo_codes if this is a customer-specific promo
            IF v_promo.customer_id IS NOT NULL THEN
                UPDATE customer_promo_codes
                SET is_used = true, 
                    used_at = NOW(), 
                    used_on_order_id = p_order_id, 
                    is_active = false
                WHERE code = UPPER(p_promo_code) AND customer_id = v_promo.customer_id;
            END IF;
        END IF;
    END IF;
    
    -- Apply loyalty points discount (10 points = Rs. 1)
    IF p_loyalty_points_used > 0 AND v_customer_found THEN
        IF v_customer_loyalty_points >= p_loyalty_points_used THEN
            v_points_discount := ROUND(p_loyalty_points_used * 0.1, 2);
            
            -- Deduct points by inserting a negative redemption record
            INSERT INTO loyalty_points (customer_id, order_id, points, type, description)
            VALUES (v_customer_id, p_order_id, -p_loyalty_points_used, 'redeemed', 'Redeemed for bill discount');
        END IF;
    END IF;
    
    -- Calculate totals
    v_total_discount := p_manual_discount + v_promo_discount + v_points_discount;
    v_tax := ROUND((v_order.subtotal - v_total_discount) * 0.05, 2); -- 5% GST
    v_final_total := v_order.subtotal - v_total_discount + v_tax + p_service_charge + v_order.delivery_fee + p_tip;
    
    -- Calculate loyalty points earned (1 point per Rs. 100 spent)
    IF v_customer_found THEN
        v_points_earned := FLOOR(v_final_total / 100);
    END IF;
    
    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD((SELECT COUNT(*) + 1 FROM invoices WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 4, '0');
    
    -- Generate table session ID if dine-in
    IF v_order.order_type = 'dine-in' THEN
        v_table_session_id := gen_random_uuid();
    END IF;
    
    -- Get brand info
    v_brand_info := '{
        "name": "ZOIRO Broast",
        "tagline": "Injected Broast - Saucy. Juicy. Crispy.",
        "address": "Main Branch, City Center",
        "phone": "+92 300 1234567",
        "email": "info@zoiro.com",
        "ntn": "1234567-8",
        "strn": "12-34-5678-901-23",
        "logo_url": "/assets/logo.png",
        "website": "www.zoiro.com"
    }'::jsonb;
    
    -- Create invoice
    INSERT INTO invoices (
        invoice_number,
        order_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        items,
        subtotal,
        discount,
        discount_details,
        tax,
        service_charge,
        delivery_fee,
        tip,
        total,
        payment_method,
        payment_status,
        bill_status,
        promo_code_id,
        promo_code_value,
        loyalty_points_earned,
        loyalty_points_used,
        table_number,
        table_session_id,
        served_by,
        billed_by,
        brand_info,
        notes
    ) VALUES (
        v_invoice_number,
        p_order_id,
        v_customer_id,
        COALESCE(v_customer_name, v_order.customer_name, 'Walk-in Customer'),
        COALESCE(v_customer_phone, v_order.customer_phone),
        COALESCE(v_customer_email, v_order.customer_email),
        v_order.order_type,
        v_order.items,
        v_order.subtotal,
        v_total_discount,
        json_build_object(
            'manual_discount', p_manual_discount,
            'promo_discount', v_promo_discount,
            'promo_code', p_promo_code,
            'points_discount', v_points_discount,
            'points_used', p_loyalty_points_used
        ),
        v_tax,
        p_service_charge,
        v_order.delivery_fee,
        p_tip,
        v_final_total,
        v_effective_payment_method,
        'paid',
        'paid',
        v_promo_id,
        p_promo_code,
        v_points_earned,
        p_loyalty_points_used,
        v_order.table_number,
        v_table_session_id,
        v_order.waiter_id,
        v_employee_id,
        v_brand_info,
        p_notes
    ) RETURNING id INTO v_new_invoice_id;
    
    -- Award loyalty points to customer (insert new record, not upsert)
    IF v_customer_found AND v_points_earned > 0 THEN
        INSERT INTO loyalty_points (customer_id, order_id, points, type, description)
        VALUES (v_customer_id, p_order_id, v_points_earned, 'earned', 'Earned from bill payment - Invoice #' || v_invoice_number);
    END IF;
    
    -- Always calculate total points if customer found (needed for response)
    IF v_customer_found THEN
        SELECT COALESCE(SUM(points), 0)::INT
        INTO v_total_customer_points
        FROM loyalty_points
        WHERE customer_id = v_customer_id;
        
        -- Auto-award promo codes for loyalty thresholds
        -- This runs directly without relying on external functions
        BEGIN
            DECLARE
                v_threshold_settings JSONB;
                v_threshold JSONB;
                v_expiry_days INT := 60;
                v_already_awarded INT[];
                v_threshold_points INT;
                v_new_code TEXT;
            BEGIN
                -- Check if perks_settings table exists
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'perks_settings') THEN
                    
                    -- Get thresholds already awarded to this customer from promo_codes table
                    SELECT ARRAY_AGG(DISTINCT loyalty_points_required)
                    INTO v_already_awarded
                    FROM promo_codes
                    WHERE customer_id = v_customer_id 
                      AND loyalty_points_required IS NOT NULL;
                    
                    v_already_awarded := COALESCE(v_already_awarded, ARRAY[]::INT[]);
                    
                    -- Get loyalty thresholds from settings
                    SELECT setting_value INTO v_threshold_settings
                    FROM perks_settings
                    WHERE setting_key = 'loyalty_thresholds' AND is_active = true;
                    
                    -- Get expiry days from settings
                    BEGIN
                        SELECT COALESCE((setting_value->>'reward_codes')::INT, 60)
                        INTO v_expiry_days
                        FROM perks_settings
                        WHERE setting_key = 'promo_expiry_days';
                    EXCEPTION WHEN OTHERS THEN
                        v_expiry_days := 60;
                    END;
                    
                    -- Process thresholds if configured
                    IF v_threshold_settings IS NOT NULL AND jsonb_typeof(v_threshold_settings) = 'array' THEN
                        FOR v_threshold IN SELECT value FROM jsonb_array_elements(v_threshold_settings) AS value ORDER BY (value->>'points')::INT DESC
                        LOOP
                            v_threshold_points := (v_threshold->>'points')::INT;
                            
                            -- Check if customer qualifies and hasn't already received this threshold promo
                            IF v_total_customer_points >= v_threshold_points 
                               AND NOT (v_threshold_points = ANY(v_already_awarded)) THEN
                                
                                -- Generate unique promo code
                                v_new_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(v_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
                                
                                -- Ensure code is unique
                                WHILE EXISTS (SELECT 1 FROM promo_codes WHERE code = v_new_code) LOOP
                                    v_new_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(v_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
                                END LOOP;
                                
                                -- Insert into promo_codes table (single table for all promo codes)
                                INSERT INTO promo_codes (
                                    code, name, description, promo_type, value, max_discount,
                                    valid_from, valid_until, usage_limit, current_usage, is_active, 
                                    customer_id, loyalty_points_required
                                ) VALUES (
                                    v_new_code, 
                                    COALESCE(v_threshold->>'promo_name', v_threshold_points || ' Points Reward'),
                                    'Loyalty reward for reaching ' || v_threshold_points || ' points',
                                    COALESCE(v_threshold->>'promo_type', 'percentage')::promo_type, 
                                    COALESCE((v_threshold->>'promo_value')::DECIMAL, 10), 
                                    (v_threshold->>'max_discount')::DECIMAL,
                                    NOW(), 
                                    NOW() + (v_expiry_days || ' days')::INTERVAL,
                                    1, 0, true, 
                                    v_customer_id, v_threshold_points
                                );
                                
                                -- Set reward info for response
                                v_reward_promo_code := v_new_code;
                                v_reward_promo_generated := TRUE;
                                
                                -- Award highest eligible threshold first, exit after one
                                EXIT;
                            END IF;
                        END LOOP;
                    END IF;
                END IF;
            END;
        EXCEPTION WHEN OTHERS THEN
            -- Don't fail invoice generation if promo award fails
            -- Just continue without awarding promo
            NULL;
        END;
    END IF;
    
    -- Store in customer invoice records if registered
    IF v_customer_found THEN
        INSERT INTO customer_invoice_records (
            customer_id, invoice_id, invoice_number, order_id, order_type,
            items, subtotal, discount, tax, total,
            payment_method, payment_status, promo_code_used,
            loyalty_points_used, loyalty_points_earned
        ) VALUES (
            v_customer_id, v_new_invoice_id, v_invoice_number, p_order_id, v_order.order_type,
            v_order.items, v_order.subtotal, v_total_discount, v_tax, v_final_total,
            p_payment_method, 'paid', p_promo_code,
            p_loyalty_points_used, v_points_earned
        );
    END IF;
    
    -- Update order status
    UPDATE orders
    SET status = 'delivered',
        payment_status = 'paid',
        payment_method = p_payment_method::payment_method,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Add tip to waiter if applicable
    IF p_tip > 0 AND v_order.waiter_id IS NOT NULL THEN
        UPDATE employees
        SET total_tips = COALESCE(total_tips, 0) + p_tip,
            updated_at = NOW()
        WHERE id = v_order.waiter_id;
        
        -- Insert into waiter tips table if exists
        BEGIN
            INSERT INTO waiter_tips (waiter_id, order_id, invoice_id, tip_amount, date)
            VALUES (v_order.waiter_id, p_order_id, v_new_invoice_id, p_tip, CURRENT_DATE);
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;
    END IF;
    
    -- Free up table if dine-in
    IF v_order.order_type = 'dine-in' AND v_order.table_number IS NOT NULL THEN
        UPDATE restaurant_tables
        SET status = 'cleaning',
            current_order_id = NULL,
            current_customers = 0,
            assigned_waiter_id = NULL,
            updated_at = NOW()
        WHERE table_number = v_order.table_number;
    END IF;
    
    -- Add to order status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, 'delivered'::order_status, v_employee_id, 'Bill generated - Invoice #' || v_invoice_number);
    
    -- Return success with invoice details
    RETURN json_build_object(
        'success', true,
        'invoice_id', v_new_invoice_id,
        'invoice_number', v_invoice_number,
        'customer', json_build_object(
            'id', v_customer_id,
            'name', COALESCE(v_customer_name, v_order.customer_name, 'Walk-in Customer'),
            'is_registered', v_customer_found,
            'points_earned', v_points_earned,
            'total_points', v_total_customer_points
        ),
        'totals', json_build_object(
            'subtotal', v_order.subtotal,
            'discount', v_total_discount,
            'tax', v_tax,
            'service_charge', p_service_charge,
            'delivery_fee', v_order.delivery_fee,
            'tip', p_tip,
            'total', v_final_total
        ),
        'discount_breakdown', json_build_object(
            'manual', p_manual_discount,
            'promo', v_promo_discount,
            'promo_code', p_promo_code,
            'points', v_points_discount
        ),
        'reward_promo', json_build_object(
            'generated', v_reward_promo_generated,
            'code', v_reward_promo_code
        ),
        'message', CASE WHEN v_reward_promo_generated 
            THEN 'Invoice generated successfully! Customer earned a reward promo code: ' || v_reward_promo_code
            ELSE 'Invoice generated successfully'
        END
    );
END;
$$;


--
-- Name: FUNCTION generate_advanced_invoice(p_order_id uuid, p_payment_method text, p_manual_discount numeric, p_tip numeric, p_service_charge numeric, p_promo_code text, p_loyalty_points_used integer, p_notes text, p_biller_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_advanced_invoice(p_order_id uuid, p_payment_method text, p_manual_discount numeric, p_tip numeric, p_service_charge numeric, p_promo_code text, p_loyalty_points_used integer, p_notes text, p_biller_id uuid) IS 'Creates complete invoice with all features';


--
-- Name: generate_attendance_code(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_attendance_code(p_valid_minutes integer DEFAULT 30) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    emp_role TEXT;
    new_code VARCHAR(6);
    valid_from_time TIME;
    valid_until_time TIME;
    current_uid UUID;
    current_time_local TIME;
BEGIN
    -- Debug: Get the current auth user ID
    current_uid := auth.uid();
    current_time_local := LOCALTIME;
    
    -- Get employee info
    SELECT id, role INTO emp_id, emp_role 
    FROM employees 
    WHERE auth_user_id = current_uid 
    AND status = 'active'
    LIMIT 1;
    
    -- Check authorization
    IF emp_id IS NULL THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Employee not found for auth user',
            'debug_auth_uid', current_uid::TEXT
        );
    END IF;
    
    IF emp_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Not authorized - role is: ' || COALESCE(emp_role, 'NULL')
        );
    END IF;
    
    -- Auto-cleanup: Delete all expired, inactive, and old codes
    DELETE FROM attendance_codes
    WHERE valid_for_date < CURRENT_DATE
       OR (valid_for_date = CURRENT_DATE AND valid_until < current_time_local)
       OR is_active = false;
    
    -- Generate random 6-digit alphanumeric code
    new_code := UPPER(SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
    
    -- Set validity window
    valid_from_time := current_time_local;
    valid_until_time := (current_time_local + (p_valid_minutes || ' minutes')::INTERVAL)::TIME;
    
    -- Deactivate all previous active codes for today (then they'll be deleted next cleanup)
    UPDATE attendance_codes
    SET is_active = false
    WHERE valid_for_date = CURRENT_DATE
    AND is_active = true;
    
    -- Insert new code
    INSERT INTO attendance_codes (
        code, 
        generated_by, 
        valid_for_date, 
        valid_from, 
        valid_until,
        is_active,
        created_at
    )
    VALUES (
        new_code, 
        emp_id, 
        CURRENT_DATE, 
        valid_from_time, 
        valid_until_time,
        true,
        NOW()
    );
    
    RETURN json_build_object(
        'success', true, 
        'code', new_code,
        'valid_from', valid_from_time,
        'valid_until', valid_until_time,
        'expires_in_minutes', p_valid_minutes
    );
END;
$$;


--
-- Name: FUNCTION generate_attendance_code(p_valid_minutes integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_attendance_code(p_valid_minutes integer) IS 'Generate attendance code - admin/manager only';


--
-- Name: generate_customer_promo_code(uuid, integer, text, text, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_customer_promo_code(p_customer_id uuid, p_points_required integer, p_promo_type text, p_promo_name text, p_promo_value numeric, p_max_discount numeric DEFAULT NULL::numeric) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_code TEXT;
    v_expiry_days INT;
    v_new_promo_id UUID;
    v_customer_name TEXT;
BEGIN
    -- Get customer name
    SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id;
    
    IF v_customer_name IS NULL THEN
        RAISE NOTICE 'Customer not found: %', p_customer_id;
        RETURN json_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    -- SAFETY CHECK: Prevent duplicate threshold promo codes - check BOTH tables
    IF EXISTS (
        SELECT 1 FROM customer_promo_codes 
        WHERE customer_id = p_customer_id 
        AND loyalty_points_required = p_points_required
    ) OR EXISTS (
        SELECT 1 FROM promo_codes 
        WHERE customer_id = p_customer_id 
        AND loyalty_points_required = p_points_required
    ) THEN
        RAISE NOTICE 'Customer % already has promo for threshold %', p_customer_id, p_points_required;
        RETURN json_build_object(
            'success', false, 
            'error', 'Customer already has a promo code for this threshold',
            'threshold', p_points_required
        );
    END IF;
    
    -- Get expiry days from settings
    SELECT COALESCE((setting_value->>'reward_codes')::INT, 60)
    INTO v_expiry_days
    FROM perks_settings
    WHERE setting_key = 'promo_expiry_days';
    
    v_expiry_days := COALESCE(v_expiry_days, 60);
    
    -- Generate unique code
    v_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
    
    -- Check uniqueness in BOTH tables
    WHILE EXISTS (SELECT 1 FROM customer_promo_codes WHERE code = v_code) OR
          EXISTS (SELECT 1 FROM promo_codes WHERE code = v_code) LOOP
        v_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
    END LOOP;
    
    -- Insert into customer_promo_codes table
    INSERT INTO customer_promo_codes (
        customer_id, code, promo_type, value, max_discount,
        name, description, loyalty_points_required, expires_at
    ) VALUES (
        p_customer_id, v_code, p_promo_type, p_promo_value, p_max_discount,
        p_promo_name, 'Loyalty reward for ' || v_customer_name || ' - ' || p_points_required || ' points',
        p_points_required, NOW() + (v_expiry_days || ' days')::INTERVAL
    ) RETURNING id INTO v_new_promo_id;
    
    -- ALSO insert into main promo_codes table WITH customer_id and loyalty_points_required
    INSERT INTO promo_codes (
        code, name, description, promo_type, value, max_discount,
        valid_from, valid_until, usage_limit, current_usage, is_active,
        customer_id, loyalty_points_required
    ) VALUES (
        v_code, p_promo_name, 
        'Personal loyalty reward for ' || v_customer_name,
        p_promo_type::promo_type, p_promo_value, p_max_discount,
        NOW(), NOW() + (v_expiry_days || ' days')::INTERVAL,
        1, 0, true,
        p_customer_id, p_points_required
    );
    
    RAISE NOTICE 'SUCCESS: Generated promo code % for customer % at % points', v_code, v_customer_name, p_points_required;
    
    RETURN json_build_object(
        'success', true,
        'promo_id', v_new_promo_id,
        'code', v_code,
        'promo_type', p_promo_type,
        'value', p_promo_value,
        'max_discount', p_max_discount,
        'expires_at', NOW() + (v_expiry_days || ' days')::INTERVAL,
        'message', 'Promo code generated for customer'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ERROR generating promo: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: generate_employee_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_employee_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.employee_id IS NULL THEN
        NEW.employee_id = 'EMP-' || LPAD(NEXTVAL('employee_id_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_employee_report(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_employee_report(p_start_date date, p_end_date date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'employee', json_build_object(
                'id', e.id,
                'name', e.name,
                'role', e.role,
                'hired_date', e.hired_date
            ),
            'attendance', (
                SELECT json_build_object(
                    'present_days', COUNT(*) FILTER (WHERE status = 'present'),
                    'late_days', COUNT(*) FILTER (WHERE status = 'late'),
                    'absent_days', COUNT(*) FILTER (WHERE status = 'absent'),
                    'total_hours', SUM(hours_worked)
                )
                FROM attendance a
                WHERE a.employee_id = e.id
                AND a.date BETWEEN p_start_date AND p_end_date
            ),
            'performance', (
                SELECT json_build_object(
                    'orders_handled', COUNT(*),
                    'revenue_generated', SUM(total)
                )
                FROM orders o
                WHERE (o.waiter_id = e.id OR o.assigned_to = e.id)
                AND DATE(o.created_at) BETWEEN p_start_date AND p_end_date
            ),
            'tips_earned', (
                SELECT COALESCE(SUM(tip_amount), 0)
                FROM waiter_tips wt
                WHERE wt.waiter_id = e.id
                AND wt.date BETWEEN p_start_date AND p_end_date
            )
        )
    ) INTO result
    FROM employees e
    WHERE e.status = 'active';
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: generate_invoice(uuid, text, numeric, numeric, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice(p_order_id uuid, p_payment_method text, p_tip numeric DEFAULT 0, p_discount numeric DEFAULT 0, p_promo_code text DEFAULT NULL::text, p_loyalty_points_used integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    order_record RECORD;
    promo_record RECORD;
    loyalty_record RECORD;
    new_invoice_id UUID;
    promo_discount DECIMAL(10, 2) := 0;
    points_discount DECIMAL(10, 2) := 0;
    total_discount DECIMAL(10, 2);
    final_total DECIMAL(10, 2);
    points_earned INTEGER;
    result JSON;
BEGIN
    IF NOT can_access_billing() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    -- Get order
    SELECT * INTO order_record FROM orders WHERE id = p_order_id;
    
    IF order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Validate promo code if provided
    IF p_promo_code IS NOT NULL THEN
        SELECT * INTO promo_record
        FROM promo_codes
        WHERE code = p_promo_code
        AND is_active = true
        AND valid_from <= NOW()
        AND valid_until >= NOW()
        AND (usage_limit IS NULL OR current_usage < usage_limit);
        
        IF promo_record IS NOT NULL THEN
            IF promo_record.promo_type = 'percentage' THEN
                promo_discount := order_record.subtotal * (promo_record.value / 100);
                IF promo_record.max_discount IS NOT NULL THEN
                    promo_discount := LEAST(promo_discount, promo_record.max_discount);
                END IF;
            ELSE
                promo_discount := promo_record.value;
            END IF;
            
            -- Update promo usage
            UPDATE promo_codes
            SET current_usage = current_usage + 1,
                updated_at = NOW()
            WHERE id = promo_record.id;
        END IF;
    END IF;
    
    -- Calculate points discount if loyalty points used
    IF p_loyalty_points_used > 0 AND order_record.customer_id IS NOT NULL THEN
        SELECT * INTO loyalty_record
        FROM loyalty_points
        WHERE customer_id = order_record.customer_id;
        
        IF loyalty_record IS NOT NULL AND loyalty_record.points >= p_loyalty_points_used THEN
            points_discount := p_loyalty_points_used * 0.1; -- 10 points = 1 Rs
            
            -- Deduct points
            UPDATE loyalty_points
            SET points = points - p_loyalty_points_used,
                updated_at = NOW()
            WHERE customer_id = order_record.customer_id;
            
            -- Log transaction
            INSERT INTO loyalty_transactions (customer_id, points_change, transaction_type, order_id, description, created_by)
            VALUES (order_record.customer_id, -p_loyalty_points_used, 'redeemed', p_order_id, 'Redeemed for order', emp_id);
        END IF;
    END IF;
    
    total_discount := p_discount + promo_discount + points_discount;
    final_total := order_record.subtotal - total_discount + p_tip;
    
    -- Calculate loyalty points earned (1 point per 100 Rs)
    points_earned := FLOOR(final_total / 100);
    
    -- Create invoice
    INSERT INTO invoices (
        order_id, customer_id, customer_name, customer_phone, customer_email,
        order_type, items, subtotal, discount, discount_details,
        tip, total, payment_method, payment_status,
        loyalty_points_earned, table_number, served_by, billed_by
    ) VALUES (
        p_order_id,
        order_record.customer_id,
        order_record.customer_name,
        order_record.customer_phone,
        order_record.customer_email,
        order_record.order_type,
        order_record.items,
        order_record.subtotal,
        total_discount,
        json_build_object(
            'manual_discount', p_discount,
            'promo_discount', promo_discount,
            'promo_code', p_promo_code,
            'points_discount', points_discount,
            'points_used', p_loyalty_points_used
        ),
        p_tip,
        final_total,
        p_payment_method,
        'paid',
        points_earned,
        order_record.table_number,
        order_record.waiter_id,
        emp_id
    ) RETURNING id INTO new_invoice_id;
    
    -- Award loyalty points
    IF order_record.customer_id IS NOT NULL AND points_earned > 0 THEN
        INSERT INTO loyalty_points (customer_id, points, lifetime_points)
        VALUES (order_record.customer_id, points_earned, points_earned)
        ON CONFLICT (customer_id) DO UPDATE
        SET points = loyalty_points.points + points_earned,
            lifetime_points = loyalty_points.lifetime_points + points_earned,
            tier = calculate_loyalty_tier(loyalty_points.lifetime_points + points_earned),
            updated_at = NOW();
        
        INSERT INTO loyalty_transactions (customer_id, points_change, transaction_type, order_id, description, created_by)
        VALUES (order_record.customer_id, points_earned, 'earned', p_order_id, 'Earned from order', emp_id);
    END IF;
    
    -- Add tip to waiter if applicable
    IF p_tip > 0 AND order_record.waiter_id IS NOT NULL THEN
        INSERT INTO waiter_tips (waiter_id, order_id, invoice_id, tip_amount, table_id, date)
        SELECT 
            order_record.waiter_id,
            p_order_id,
            new_invoice_id,
            p_tip,
            rt.id,
            CURRENT_DATE
        FROM restaurant_tables rt
        WHERE rt.table_number = order_record.table_number;
        
        UPDATE employees
        SET total_tips = total_tips + p_tip,
            updated_at = NOW()
        WHERE id = order_record.waiter_id;
    END IF;
    
    -- Update order status
    UPDATE orders
    SET status = 'delivered',
        payment_status = 'paid',
        payment_method = p_payment_method::payment_method,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Free up table if dine-in
    IF order_record.order_type = 'dine-in' AND order_record.table_number IS NOT NULL THEN
        UPDATE restaurant_tables
        SET status = 'cleaning',
            current_order_id = NULL,
            current_customers = 0,
            updated_at = NOW()
        WHERE table_number = order_record.table_number;
        
        -- Update table history
        UPDATE table_history
        SET closed_at = NOW(),
            total_bill = final_total,
            tip_amount = p_tip
        WHERE order_id = p_order_id;
    END IF;
    
    -- Record promo usage
    IF promo_record IS NOT NULL THEN
        INSERT INTO promo_code_usage (promo_code_id, customer_id, order_id, discount_applied)
        VALUES (promo_record.id, order_record.customer_id, p_order_id, promo_discount);
    END IF;
    
    -- Return invoice details
    SELECT json_build_object(
        'success', true,
        'invoice_id', new_invoice_id,
        'invoice_number', (SELECT invoice_number FROM invoices WHERE id = new_invoice_id),
        'total', final_total,
        'points_earned', points_earned
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.invoice_number = 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 6, '0');
    RETURN NEW;
END;
$$;


--
-- Name: generate_license_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_license_id() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := 'LIC-';
    i INTEGER;
BEGIN
    FOR i IN 1..4 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    result := result || '-';
    FOR i IN 1..4 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$;


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
    RETURN NEW;
END;
$$;


--
-- Name: generate_quick_bill(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quick_bill(p_order_id uuid, p_biller_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_invoice_number TEXT;
    v_invoice_id UUID;
    v_tax DECIMAL(10, 2);
    v_final_total DECIMAL(10, 2);
    v_effective_payment_method TEXT;
BEGIN
    -- Get order with lock (fast lookup)
    SELECT id, order_number, customer_id, customer_name, customer_phone, customer_email,
           order_type, items, subtotal, discount, delivery_fee, total, 
           payment_status, transaction_id, table_number
    INTO v_order 
    FROM orders 
    WHERE id = p_order_id 
    FOR UPDATE SKIP LOCKED;
    
    IF v_order IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found or locked');
    END IF;
    
    -- Check if invoice already exists
    IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
        -- Return existing invoice info
        SELECT id, invoice_number INTO v_invoice_id, v_invoice_number 
        FROM invoices WHERE order_id = p_order_id;
        RETURN json_build_object(
            'success', true, 
            'invoice_id', v_invoice_id,
            'invoice_number', v_invoice_number,
            'message', 'Invoice already exists'
        );
    END IF;
    
    -- Auto-detect payment method for online orders
    IF v_order.transaction_id IS NOT NULL THEN
        v_effective_payment_method := 'online';
    ELSE
        v_effective_payment_method := 'cash';
    END IF;
    
    -- Simple calculations (no promo, no loyalty, no extras)
    v_tax := ROUND(COALESCE(v_order.subtotal, v_order.total * 0.95) * 0.05, 2); -- 5% GST
    v_final_total := COALESCE(v_order.subtotal, v_order.total * 0.95) - COALESCE(v_order.discount, 0) + v_tax + COALESCE(v_order.delivery_fee, 0);
    
    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD((SELECT COUNT(*) + 1 FROM invoices WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 4, '0');
    
    -- Generate invoice ID
    v_invoice_id := gen_random_uuid();
    
    -- Create invoice (minimal fields for speed)
    INSERT INTO invoices (
        id,
        invoice_number,
        order_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        items,
        subtotal,
        discount,
        tax,
        delivery_fee,
        total,
        payment_method,
        payment_status,
        bill_status,
        billed_by,
        table_number,
        created_at
    ) VALUES (
        v_invoice_id,
        v_invoice_number,
        p_order_id,
        v_order.customer_id,
        v_order.customer_name,
        v_order.customer_phone,
        v_order.customer_email,
        v_order.order_type,
        v_order.items,
        COALESCE(v_order.subtotal, v_order.total * 0.95),
        COALESCE(v_order.discount, 0),
        v_tax,
        COALESCE(v_order.delivery_fee, 0),
        v_final_total,
        v_effective_payment_method::payment_method,
        'pending',
        'generated',
        p_biller_id,
        v_order.table_number,
        NOW()
    );
    
    -- Update order status (payment_status stays as-is, just mark updated)
    UPDATE orders 
    SET updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN json_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'total', v_final_total,
        'tax', v_tax,
        'subtotal', COALESCE(v_order.subtotal, v_order.total * 0.95),
        'discount', COALESCE(v_order.discount, 0),
        'delivery_fee', COALESCE(v_order.delivery_fee, 0),
        'payment_method', v_effective_payment_method,
        'order_number', v_order.order_number,
        'order_type', v_order.order_type,
        'customer_name', COALESCE(v_order.customer_name, 'Walk-in Customer'),
        'customer_phone', v_order.customer_phone,
        'items', v_order.items,
        'table_number', v_order.table_number,
        'message', 'Bill generated successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;


--
-- Name: FUNCTION generate_quick_bill(p_order_id uuid, p_biller_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_quick_bill(p_order_id uuid, p_biller_id uuid) IS 'Fast bill generation for instant billing from Orders page. Skips promo/loyalty calculations.';


--
-- Name: generate_reorder_suggestions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_reorder_suggestions() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'item_id', i.id,
            'item_name', i.name,
            'sku', i.sku,
            'supplier', i.supplier,
            'current_stock', i.quantity,
            'reorder_point', COALESCE(i.reorder_point, i.min_quantity),
            'suggested_qty', COALESCE(i.max_quantity, 100) - COALESCE(i.quantity, 0),
            'estimated_cost', (COALESCE(i.max_quantity, 100) - COALESCE(i.quantity, 0)) * i.cost_per_unit,
            'lead_time_days', COALESCE(i.lead_time_days, 7),
            'priority', CASE 
                WHEN i.quantity <= 0 THEN 'critical'
                WHEN i.quantity <= COALESCE(i.min_quantity, 0) * 0.5 THEN 'high'
                ELSE 'medium'
            END
        )
        ORDER BY 
            CASE WHEN i.quantity <= 0 THEN 0 
                 WHEN i.quantity <= COALESCE(i.min_quantity, 0) * 0.5 THEN 1 
                 ELSE 2 END,
            i.quantity / NULLIF(i.min_quantity, 0) ASC
    ) INTO result
    FROM inventory i
    WHERE COALESCE(i.is_active, true) = true
    AND COALESCE(i.quantity, 0) <= COALESCE(i.reorder_point, i.min_quantity, 10);
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: generate_sales_report(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_sales_report(p_start_date date, p_end_date date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_build_object(
        'period', json_build_object('start', p_start_date, 'end', p_end_date),
        'summary', (
            SELECT json_build_object(
                'total_revenue', COALESCE(SUM(total), 0),
                'total_orders', COUNT(*),
                'avg_order_value', COALESCE(AVG(total), 0),
                'cancelled_orders', COUNT(*) FILTER (WHERE status = 'cancelled')
            )
            FROM orders
            WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
        ),
        'by_order_type', (
            SELECT json_agg(
                json_build_object(
                    'type', order_type,
                    'count', cnt,
                    'revenue', revenue
                )
            )
            FROM (
                SELECT order_type, COUNT(*) as cnt, SUM(total) as revenue
                FROM orders
                WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
                AND status != 'cancelled'
                GROUP BY order_type
            ) t
        ),
        'by_payment_method', (
            SELECT json_agg(
                json_build_object(
                    'method', payment_method,
                    'count', cnt,
                    'revenue', revenue
                )
            )
            FROM (
                SELECT payment_method, COUNT(*) as cnt, SUM(total) as revenue
                FROM orders
                WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
                AND status != 'cancelled'
                GROUP BY payment_method
            ) t
        ),
        'top_items', (
            SELECT json_agg(item_stats ORDER BY total_sold DESC)
            FROM (
                SELECT 
                    item->>'name' as item_name,
                    SUM((item->>'quantity')::int) as total_sold,
                    SUM((item->>'price')::decimal * (item->>'quantity')::int) as revenue
                FROM orders, jsonb_array_elements(items) as item
                WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
                AND status != 'cancelled'
                GROUP BY item->>'name'
                LIMIT 10
            ) item_stats
        ),
        'daily_breakdown', (
            SELECT json_agg(
                json_build_object(
                    'date', date,
                    'revenue', revenue,
                    'orders', orders
                )
                ORDER BY date
            )
            FROM (
                SELECT 
                    DATE(created_at) as date,
                    SUM(total) as revenue,
                    COUNT(*) as orders
                FROM orders
                WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
                AND status != 'cancelled'
                GROUP BY DATE(created_at)
            ) daily
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: generate_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_slug(text_input text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    slug TEXT;
BEGIN
    -- Convert to lowercase, replace spaces with hyphens, remove special chars
    slug := lower(trim(text_input));
    slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
    slug := regexp_replace(slug, '\s+', '-', 'g');
    slug := regexp_replace(slug, '-+', '-', 'g');
    slug := trim(both '-' from slug);
    
    -- If empty after cleanup, generate a random slug
    IF slug = '' OR slug IS NULL THEN
        slug := 'item-' || substr(md5(random()::text), 1, 8);
    END IF;
    
    RETURN slug;
END;
$$;


--
-- Name: get_absent_employees_today(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_absent_employees_today() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'date', CURRENT_DATE,
    'absent_employees', COALESCE(json_agg(
      json_build_object(
        'id', e.id,
        'employee_id', e.employee_id,
        'name', e.name,
        'role', e.role,
        'email', e.email,
        'phone', e.phone,
        'avatar_url', e.avatar_url,
        'hired_date', e.hired_date
      )
    ), '[]'::json)
  ) INTO result
  FROM employees e
  WHERE e.status = 'active'
  AND e.role != 'admin' -- Admin doesn't need attendance
  AND NOT EXISTS (
    SELECT 1 FROM attendance a
    WHERE a.employee_id = e.id
    AND a.date = CURRENT_DATE
  );
  
  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_absent_employees_today(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_absent_employees_today() IS 'Get list of absent employees today - admin/manager';


--
-- Name: get_absent_employees_today(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_absent_employees_today(p_caller_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE result JSON;
BEGIN
  IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  
  SELECT json_build_object(
    'success', true,
    'date', CURRENT_DATE,
    'absent_employees', COALESCE(json_agg(
      json_build_object('id', e.id, 'employee_id', e.employee_id, 'name', e.name, 'role', e.role, 'email', e.email, 'phone', e.phone, 'avatar_url', e.avatar_url, 'hired_date', e.hired_date)
    ), '[]'::json)
  ) INTO result
  FROM employees e
  WHERE e.status = 'active' AND e.role != 'admin'
  AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.employee_id = e.id AND a.date = CURRENT_DATE);
  
  RETURN result;
END;
$$;


--
-- Name: get_active_attendance_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_attendance_code() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    active_code RECORD;
    time_left_seconds INTEGER;
    current_time_local TIME;
BEGIN
    -- Check authorization
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Get current time without timezone
    current_time_local := LOCALTIME;
    
    -- Auto-cleanup: Delete expired and inactive codes
    DELETE FROM attendance_codes
    WHERE valid_for_date < CURRENT_DATE
       OR (valid_for_date = CURRENT_DATE AND valid_until < current_time_local)
       OR is_active = false;
    
    -- Get active code for today that hasn't expired
    SELECT 
        code,
        valid_from,
        valid_until,
        created_at
    INTO active_code
    FROM attendance_codes
    WHERE valid_for_date = CURRENT_DATE
    AND is_active = true
    AND valid_until > current_time_local
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF active_code IS NULL THEN
        RETURN json_build_object('success', true, 'has_active_code', false);
    END IF;
    
    -- Calculate time left in seconds
    time_left_seconds := EXTRACT(EPOCH FROM (active_code.valid_until - current_time_local))::INTEGER;
    
    RETURN json_build_object(
        'success', true,
        'has_active_code', true,
        'code', active_code.code,
        'valid_from', active_code.valid_from,
        'valid_until', active_code.valid_until,
        'time_left_seconds', time_left_seconds
    );
END;
$$;


--
-- Name: get_active_deals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_deals() RETURNS TABLE(id uuid, name text, slug text, description text, discount_percentage numeric, discount_amount numeric, images jsonb, minimum_order_amount numeric, valid_until timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.slug,
        d.description,
        d.discount_percentage,
        d.discount_amount,
        d.images,
        d.minimum_order_amount,
        d.valid_until
    FROM deals d
    WHERE d.is_active = TRUE
        AND (d.valid_from IS NULL OR d.valid_from <= NOW())
        AND (d.valid_until IS NULL OR d.valid_until >= NOW())
        AND (d.usage_limit IS NULL OR d.usage_count < d.usage_limit)
    ORDER BY d.created_at DESC;
END;
$$;


--
-- Name: get_active_deals_with_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_deals_with_items() RETURNS TABLE(id uuid, name text, slug text, description text, deal_type text, original_price numeric, discounted_price numeric, discount_percentage numeric, image_url text, valid_from timestamp with time zone, valid_until timestamp with time zone, code text, is_active boolean, items jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH deal_items_enriched AS (
        SELECT 
            di.deal_id,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', mi.id,
                        'quantity', di.quantity,
                        'name', mi.name,
                        'price', mi.price,
                        'image', mi.images->0
                    )
                ),
                '[]'::jsonb
            ) AS enriched_items,
            COALESCE(SUM(mi.price * di.quantity), 0) AS total_original_price
        FROM deal_items di
        JOIN menu_items mi ON mi.id = di.menu_item_id
        GROUP BY di.deal_id
    ),
    deals_with_items AS (
        SELECT 
            d.id,
            d.name,
            d.slug,
            d.description,
            'combo'::TEXT AS deal_type,
            COALESCE(die.total_original_price, 0) AS original_price,
            CASE 
                WHEN d.discount_percentage > 0 THEN 
                    ROUND(COALESCE(die.total_original_price, 0) * (1 - d.discount_percentage / 100), 2)
                ELSE COALESCE(die.total_original_price, 0)
            END AS discounted_price,
            d.discount_percentage,
            d.images->0 AS image_url,
            d.valid_from,
            d.valid_until,
            NULL::TEXT AS code,
            d.is_active,
            COALESCE(die.enriched_items, '[]'::jsonb) AS items
        FROM deals d
        LEFT JOIN deal_items_enriched die ON die.deal_id = d.id
        WHERE d.is_active = TRUE
            AND (d.valid_from IS NULL OR d.valid_from <= NOW())
            AND (d.valid_until IS NULL OR d.valid_until >= NOW())
            AND (d.usage_limit IS NULL OR d.usage_count < d.usage_limit)
    )
    SELECT * FROM deals_with_items
    ORDER BY name;
END;
$$;


--
-- Name: get_active_payment_methods(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_payment_methods() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'success', true,
        'methods', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', pm.id,
                    'method_type', pm.method_type,
                    'method_name', pm.method_name,
                    'account_number', pm.account_number,
                    'account_holder_name', pm.account_holder_name,
                    'bank_name', pm.bank_name,
                    'display_order', pm.display_order
                ) ORDER BY pm.display_order, pm.method_name
            )
            FROM payment_methods pm
            WHERE pm.is_active = true
        ), '[]'::json),
        'fetched_at', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_active_payment_methods(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_active_payment_methods() IS 'Get active payment methods for customer checkout';


--
-- Name: get_admin_dashboard_stats(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_dashboard_stats(p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_sales', (
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status NOT IN ('cancelled')
        ),
        'total_sales_today', (
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE DATE(created_at) = CURRENT_DATE
              AND status NOT IN ('cancelled')
        ),
        'total_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
        ),
        'total_orders_today', (
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) = CURRENT_DATE
        ),
        'completed_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status = 'delivered'
        ),
        'cancelled_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status = 'cancelled'
        ),
        'pending_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE status IN ('pending', 'confirmed', 'preparing')
        ),
        'avg_order_value', (
            SELECT COALESCE(AVG(total), 0)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status NOT IN ('cancelled')
        ),
        'active_tables', (
            SELECT COUNT(*)
            FROM restaurant_tables
            WHERE status = 'occupied'
        ),
        'total_tables', (
            SELECT COUNT(*)
            FROM restaurant_tables
        ),
        'active_employees', (
            SELECT COUNT(*)
            FROM employees
            WHERE status = 'active'
        ),
        'present_today', (
            SELECT COUNT(*)
            FROM attendance
            WHERE date = CURRENT_DATE
              AND check_in IS NOT NULL
        ),
        'low_inventory_count', (
            SELECT COUNT(*)
            FROM inventory
            WHERE quantity <= min_quantity
        ),
        'date_range', json_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_admin_reviews(text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_reviews(p_status text DEFAULT NULL::text, p_min_rating integer DEFAULT NULL::integer, p_max_rating integer DEFAULT NULL::integer, p_limit integer DEFAULT 100) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'id', r.id,
            'customer', (
                SELECT json_build_object('id', c.id, 'name', c.name, 'email', c.email)
                FROM customers c WHERE c.id = r.customer_id
            ),
            'order_id', r.order_id,
            'item', CASE 
                WHEN r.item_id IS NOT NULL THEN (
                    SELECT json_build_object('id', mi.id, 'name', mi.name, 'image', mi.image)
                    FROM menu_items mi WHERE mi.id = r.item_id
                )
                ELSE NULL
            END,
            'meal', CASE 
                WHEN r.meal_id IS NOT NULL THEN (
                    SELECT json_build_object('id', m.id, 'name', m.name, 'image', m.image)
                    FROM meals m WHERE m.id = r.meal_id
                )
                ELSE NULL
            END,
            'rating', r.rating,
            'comment', r.comment,
            'images', r.images,
            'is_verified', r.is_verified,
            'is_visible', r.is_visible,
            'admin_reply', r.admin_reply,
            'replied_at', r.replied_at,
            'created_at', r.created_at
        )
        ORDER BY r.created_at DESC
    ) INTO result
    FROM reviews r
    WHERE (p_status IS NULL OR 
           (p_status = 'visible' AND r.is_visible = true) OR
           (p_status = 'hidden' AND r.is_visible = false) OR
           (p_status = 'verified' AND r.is_verified = true))
    AND (p_min_rating IS NULL OR r.rating >= p_min_rating)
    AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_admin_reviews_advanced(text, integer, integer, boolean, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_reviews_advanced(p_status text DEFAULT NULL::text, p_min_rating integer DEFAULT NULL::integer, p_max_rating integer DEFAULT NULL::integer, p_has_reply boolean DEFAULT NULL::boolean, p_sort_by text DEFAULT 'recent'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_admin_reviews_by_employee(uuid, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_reviews_by_employee(p_employee_id uuid, p_status text DEFAULT NULL::text, p_min_rating integer DEFAULT NULL::integer, p_max_rating integer DEFAULT NULL::integer, p_limit integer DEFAULT 50) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    v_role TEXT;
BEGIN
    -- Check if employee exists and is manager or admin
    SELECT role INTO v_role 
    FROM employees 
    WHERE id = p_employee_id 
    AND status = 'active';
    
    IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Get reviews
    SELECT json_build_object(
        'success', true,
        'reviews', COALESCE((
            SELECT json_agg(review_data ORDER BY created_at DESC)
            FROM (
                SELECT 
                    r.id,
                    json_build_object(
                        'id', c.id, 
                        'name', COALESCE(c.name, 'Anonymous'), 
                        'email', c.email,
                        'phone', c.phone
                    ) as customer,
                    r.order_id,
                    CASE 
                        WHEN r.item_id IS NOT NULL THEN (
                            SELECT json_build_object('id', mi.id, 'name', mi.name, 'image', mi.images[1])
                            FROM menu_items mi WHERE mi.id = r.item_id
                        )
                        ELSE NULL
                    END as item,
                    CASE 
                        WHEN r.meal_id IS NOT NULL THEN (
                            SELECT json_build_object('id', m.id, 'name', m.name, 'image', m.images[1])
                            FROM meals m WHERE m.id = r.meal_id
                        )
                        ELSE NULL
                    END as meal,
                    r.rating,
                    r.comment,
                    r.images,
                    r.is_verified,
                    r.is_visible,
                    r.admin_reply,
                    r.replied_at,
                    r.replied_by,
                    r.helpful_count,
                    r.created_at
                FROM reviews r
                LEFT JOIN customers c ON c.id = r.customer_id
                WHERE (p_status IS NULL OR 
                       (p_status = 'all') OR
                       (p_status = 'visible' AND r.is_visible = true) OR
                       (p_status = 'hidden' AND r.is_visible = false) OR
                       (p_status = 'verified' AND r.is_verified = true) OR
                       (p_status = 'pending_reply' AND r.admin_reply IS NULL) OR
                       (p_status = 'replied' AND r.admin_reply IS NOT NULL))
                AND (p_min_rating IS NULL OR r.rating >= p_min_rating)
                AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
                LIMIT p_limit
            ) AS review_data
        ), '[]'::json),
        'stats', (
            SELECT json_build_object(
                'total', COUNT(*),
                'visible', COUNT(*) FILTER (WHERE is_visible = true),
                'hidden', COUNT(*) FILTER (WHERE is_visible = false),
                'verified', COUNT(*) FILTER (WHERE is_verified = true),
                'pending_reply', COUNT(*) FILTER (WHERE admin_reply IS NULL),
                'replied', COUNT(*) FILTER (WHERE admin_reply IS NOT NULL),
                'avg_rating', ROUND(AVG(rating)::numeric, 1),
                'five_star', COUNT(*) FILTER (WHERE rating = 5),
                'four_star', COUNT(*) FILTER (WHERE rating = 4),
                'three_star', COUNT(*) FILTER (WHERE rating = 3),
                'two_star', COUNT(*) FILTER (WHERE rating = 2),
                'one_star', COUNT(*) FILTER (WHERE rating = 1)
            )
            FROM reviews
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_all_customer_promo_codes_admin(integer, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_customer_promo_codes_admin(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_filter text DEFAULT 'all'::text, p_search text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
    v_total INT;
BEGIN
    -- Get total count from promo_codes table
    SELECT COUNT(*) INTO v_total
    FROM promo_codes pc
    LEFT JOIN customers c ON c.id = pc.customer_id
    WHERE (p_search IS NULL 
           OR c.name ILIKE '%' || p_search || '%'
           OR c.phone ILIKE '%' || p_search || '%'
           OR pc.code ILIKE '%' || p_search || '%')
      AND (p_filter = 'all'
           OR (p_filter = 'active' AND pc.is_active = true AND (pc.usage_limit IS NULL OR pc.current_usage < pc.usage_limit) AND pc.valid_until > NOW())
           OR (p_filter = 'used' AND pc.usage_limit IS NOT NULL AND pc.current_usage >= pc.usage_limit)
           OR (p_filter = 'expired' AND pc.valid_until < NOW()));

    -- Get paginated results from promo_codes table
    SELECT COALESCE(json_agg(row_to_json(promo_row)), '[]'::json)
    INTO v_result
    FROM (
        SELECT 
            pc.id,
            pc.customer_id,
            COALESCE(c.name, 'All Customers') as customer_name,
            c.email as customer_email,
            c.phone as customer_phone,
            pc.code,
            pc.promo_type::TEXT as promo_type,
            pc.value,
            pc.max_discount,
            pc.name,
            pc.description,
            pc.usage_limit,
            pc.current_usage,
            pc.is_active,
            (pc.usage_limit IS NOT NULL AND pc.current_usage >= pc.usage_limit) as is_used,
            NULL::TIMESTAMPTZ as used_at,
            pc.valid_until as expires_at,
            pc.created_at,
            CASE 
                WHEN pc.usage_limit IS NOT NULL AND pc.current_usage >= pc.usage_limit THEN 'used'
                WHEN pc.valid_until < NOW() THEN 'expired'
                WHEN pc.is_active THEN 'active'
                ELSE 'inactive'
            END as status
        FROM promo_codes pc
        LEFT JOIN customers c ON c.id = pc.customer_id
        WHERE (p_search IS NULL 
               OR c.name ILIKE '%' || p_search || '%'
               OR c.phone ILIKE '%' || p_search || '%'
               OR pc.code ILIKE '%' || p_search || '%')
          AND (p_filter = 'all'
               OR (p_filter = 'active' AND pc.is_active = true AND (pc.usage_limit IS NULL OR pc.current_usage < pc.usage_limit) AND pc.valid_until > NOW())
               OR (p_filter = 'used' AND pc.usage_limit IS NOT NULL AND pc.current_usage >= pc.usage_limit)
               OR (p_filter = 'expired' AND pc.valid_until < NOW()))
        ORDER BY pc.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) promo_row;

    RETURN json_build_object(
        'success', true,
        'promos', v_result,
        'total', v_total,
        'limit', p_limit,
        'offset', p_offset
    );
END;
$$;


--
-- Name: get_all_customers_admin(integer, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_customers_admin(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text, p_filter text DEFAULT 'all'::text) RETURNS TABLE(customer_id uuid, customer_name text, customer_email text, customer_phone text, customer_address text, is_verified boolean, is_banned boolean, ban_reason text, banned_at timestamp with time zone, created_at timestamp with time zone, total_orders bigint, total_spending numeric, online_orders bigint, dine_in_orders bigint, takeaway_orders bigint, last_order_date timestamp with time zone, loyalty_points integer, total_invoices bigint, total_invoice_amount numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS customer_id,
        c.name::TEXT AS customer_name,
        c.email::TEXT AS customer_email,
        c.phone::TEXT AS customer_phone,
        c.address::TEXT AS customer_address,
        c.is_verified,
        COALESCE(c.is_banned, false) AS is_banned,
        c.ban_reason::TEXT,
        c.banned_at,
        c.created_at,
        -- Order statistics
        COALESCE(os.total_orders, 0) AS total_orders,
        COALESCE(os.total_spending, 0) AS total_spending,
        COALESCE(os.online_orders, 0) AS online_orders,
        COALESCE(os.dine_in_orders, 0) AS dine_in_orders,
        COALESCE(os.takeaway_orders, 0) AS takeaway_orders,
        os.last_order_date,
        -- Loyalty points
        COALESCE(lp.points, 0)::INTEGER AS loyalty_points,
        -- Invoice stats
        COALESCE(inv.total_invoices, 0) AS total_invoices,
        COALESCE(inv.total_invoice_amount, 0) AS total_invoice_amount
    FROM customers c
    -- Order stats subquery
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_orders,
            SUM(total) AS total_spending,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'online') AS online_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'dine-in') AS dine_in_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'walk-in') AS takeaway_orders,
            MAX(o.created_at) AS last_order_date
        FROM orders o
        WHERE o.customer_id = c.id
    ) os ON true
    -- Loyalty points subquery
    LEFT JOIN LATERAL (
        SELECT SUM(lpt.points) AS points
        FROM loyalty_points lpt
        WHERE lpt.customer_id = c.id
    ) lp ON true
    -- Invoice stats subquery
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_invoices,
            SUM(cir.total) AS total_invoice_amount
        FROM customer_invoice_records cir
        WHERE cir.customer_id = c.id
    ) inv ON true
    WHERE 
        -- Search filter
        (p_search IS NULL OR 
         c.name ILIKE '%' || p_search || '%' OR 
         c.email ILIKE '%' || p_search || '%' OR 
         c.phone ILIKE '%' || p_search || '%')
        -- Ban filter
        AND (
            p_filter = 'all' 
            OR (p_filter = 'active' AND (c.is_banned IS NULL OR c.is_banned = false))
            OR (p_filter = 'banned' AND c.is_banned = true)
        )
    ORDER BY c.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


--
-- Name: get_all_customers_loyalty(integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_customers_loyalty(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT json_build_object(
            'customers', COALESCE(json_agg(c ORDER BY total_points DESC), '[]'::json),
            'total', (SELECT COUNT(*) FROM customers
                      WHERE p_search IS NULL 
                         OR name ILIKE '%' || p_search || '%'
                         OR phone ILIKE '%' || p_search || '%'
                         OR email ILIKE '%' || p_search || '%')
        )
        FROM (
            SELECT 
                cust.id as customer_id, 
                cust.name as customer_name, 
                cust.phone as customer_phone, 
                cust.email as customer_email,
                cust.created_at as member_since,
                -- Calculate total points from loyalty_points transaction log
                COALESCE((
                    SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id
                ), 0)::INT as total_points,
                -- Current balance (same as total for now since we track transactions)
                COALESCE((
                    SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id
                ), 0)::INT as current_balance,
                -- Calculate tier based on total points using CASE
                CASE 
                    WHEN COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0) >= 1000 THEN 'platinum'
                    WHEN COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0) >= 500 THEN 'gold'
                    WHEN COALESCE((SELECT SUM(lp.points) FROM loyalty_points lp WHERE lp.customer_id = cust.id), 0) >= 250 THEN 'silver'
                    ELSE 'bronze'
                END as tier,
                -- Earned points (type = 'earned' or 'bonus')
                COALESCE((
                    SELECT SUM(lp.points) FROM loyalty_points lp 
                    WHERE lp.customer_id = cust.id AND lp.type IN ('earned', 'bonus')
                ), 0)::INT as total_points_earned,
                -- Redeemed points (type = 'redeemed', stored as negative)
                COALESCE((
                    SELECT ABS(SUM(lp.points)) FROM loyalty_points lp 
                    WHERE lp.customer_id = cust.id AND lp.type = 'redeemed'
                ), 0)::INT as total_points_redeemed,
                -- Order stats
                COALESCE((
                    SELECT COUNT(*) FROM orders o WHERE o.customer_id = cust.id
                ), 0)::INT as total_transactions,
                (SELECT MIN(o.created_at) FROM orders o WHERE o.customer_id = cust.id) as first_transaction,
                (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = cust.id) as last_transaction,
                -- Active promos count from promo_codes table
                (SELECT COUNT(*) FROM promo_codes pc 
                 WHERE pc.customer_id = cust.id AND pc.is_active = true 
                 AND (pc.usage_limit IS NULL OR pc.current_usage < pc.usage_limit)
                 AND pc.valid_until > NOW()) as active_promos
            FROM customers cust
            WHERE p_search IS NULL 
               OR cust.name ILIKE '%' || p_search || '%'
               OR cust.phone ILIKE '%' || p_search || '%'
               OR cust.email ILIKE '%' || p_search || '%'
            ORDER BY (SELECT COALESCE(SUM(lp.points), 0) FROM loyalty_points lp WHERE lp.customer_id = cust.id) DESC
            LIMIT p_limit OFFSET p_offset
        ) c
    );
END;
$$;


--
-- Name: get_all_deals_with_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_deals_with_items() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', d.id, 'name', d.name, 'description', d.description, 'code', d.code, 'deal_type', d.deal_type,
            'original_price', d.original_price, 'discounted_price', d.discounted_price, 'discount_percentage', d.discount_percentage,
            'image_url', d.image_url, 'valid_from', d.valid_from, 'valid_until', d.valid_until,
            'usage_limit', d.usage_limit, 'usage_count', d.usage_count, 'is_active', d.is_active, 'is_featured', d.is_featured, 'created_at', d.created_at,
            'items', COALESCE((
                SELECT json_agg(json_build_object('id', m.id, 'name', m.name, 'price', m.price, 'quantity', di.quantity, 'image', m.images->0))
                FROM deal_items di JOIN menu_items m ON m.id = di.menu_item_id WHERE di.deal_id = d.id
            ), '[]'::json)
        ) ORDER BY d.created_at DESC
    ) INTO result FROM deals d;
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_all_employees(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_employees() RETURNS TABLE(id uuid, employee_id text, email text, name text, phone text, role public.user_role, permissions jsonb, status text, is_verified boolean, avatar_url text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id, e.employee_id, e.email, e.name, e.phone,
        e.role, e.permissions, e.status, e.is_verified,
        e.avatar_url, e.created_at
    FROM employees e
    ORDER BY e.created_at DESC;
END;
$$;


--
-- Name: get_all_leave_requests(character varying, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_leave_requests(p_status character varying DEFAULT NULL::character varying, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', COALESCE(json_agg(
      json_build_object(
        'id', lr.id,
        'employee_id', lr.employee_id,
        'leave_type', lr.leave_type,
        'start_date', lr.start_date,
        'end_date', lr.end_date,
        'total_days', lr.total_days,
        'reason', lr.reason,
        'status', lr.status,
        'reviewed_by', lr.reviewed_by,
        'reviewed_at', lr.reviewed_at,
        'review_notes', lr.review_notes,
        'created_at', lr.created_at,
        'employee', json_build_object(
          'id', e.id,
          'employee_id', e.employee_id,
          'name', e.name,
          'email', e.email,
          'phone', e.phone,
          'role', e.role,
          'avatar_url', e.avatar_url
        ),
        'reviewer', CASE WHEN r.id IS NOT NULL THEN
          json_build_object('id', r.id, 'name', r.name, 'role', r.role)
        ELSE NULL END
      ) ORDER BY 
        CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END,
        lr.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM leave_requests lr
  INNER JOIN employees e ON e.id = lr.employee_id
  LEFT JOIN employees r ON r.id = lr.reviewed_by
  WHERE EXTRACT(YEAR FROM lr.start_date) = p_year
  AND (p_status IS NULL OR lr.status = p_status)
  AND (p_month IS NULL OR EXTRACT(MONTH FROM lr.start_date) = p_month);
  
  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_all_leave_requests(p_status character varying, p_year integer, p_month integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_all_leave_requests(p_status character varying, p_year integer, p_month integer) IS 'Get all leave requests - admin/manager only';


--
-- Name: get_all_leave_requests(uuid, character varying, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_leave_requests(p_caller_id uuid, p_status character varying DEFAULT NULL::character varying, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE result JSON;
BEGIN
  IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', COALESCE(json_agg(
      json_build_object('id', lr.id, 'employee_id', lr.employee_id, 'leave_type', lr.leave_type, 'start_date', lr.start_date,
        'end_date', lr.end_date, 'total_days', lr.total_days, 'reason', lr.reason, 'status', lr.status,
        'reviewed_by', lr.reviewed_by, 'reviewed_at', lr.reviewed_at, 'review_notes', lr.review_notes, 'created_at', lr.created_at,
        'employee', json_build_object('id', e.id, 'employee_id', e.employee_id, 'name', e.name, 'email', e.email, 'phone', e.phone, 'role', e.role, 'avatar_url', e.avatar_url),
        'reviewer', CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'name', r.name, 'role', r.role) ELSE NULL END
      ) ORDER BY CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END, lr.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM leave_requests lr
  INNER JOIN employees e ON e.id = lr.employee_id
  LEFT JOIN employees r ON r.id = lr.reviewed_by
  WHERE EXTRACT(YEAR FROM lr.start_date) = p_year
  AND (p_status IS NULL OR lr.status = p_status)
  AND (p_month IS NULL OR EXTRACT(MONTH FROM lr.start_date) = p_month);
  
  RETURN result;
END;
$$;


--
-- Name: get_all_orders(public.order_status, public.order_type, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_orders(p_status public.order_status DEFAULT NULL::public.order_status, p_order_type public.order_type DEFAULT NULL::public.order_type, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, order_number text, customer_id uuid, customer_name text, customer_phone text, status public.order_status, order_type public.order_type, total numeric, created_at timestamp with time zone, items jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id, o.order_number, o.customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        o.status, o.order_type, o.total, o.created_at, o.items
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE 
        (p_status IS NULL OR o.status = p_status)
        AND (p_order_type IS NULL OR o.order_type = p_order_type)
    ORDER BY o.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


--
-- Name: get_all_payment_methods(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_payment_methods() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized. Only admin and manager can access all payment methods.'
        );
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'methods', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', pm.id,
                    'method_type', pm.method_type,
                    'method_name', pm.method_name,
                    'account_number', pm.account_number,
                    'account_holder_name', pm.account_holder_name,
                    'bank_name', pm.bank_name,
                    'is_active', pm.is_active,
                    'display_order', pm.display_order,
                    'created_at', pm.created_at,
                    'updated_at', pm.updated_at
                ) ORDER BY pm.display_order, pm.method_name
            )
            FROM payment_methods pm
        ), '[]'::json),
        'stats', json_build_object(
            'total', (SELECT COUNT(*) FROM payment_methods),
            'active', (SELECT COUNT(*) FROM payment_methods WHERE is_active = true),
            'inactive', (SELECT COUNT(*) FROM payment_methods WHERE is_active = false),
            'jazzcash', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'jazzcash' AND is_active = true),
            'easypaisa', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'easypaisa' AND is_active = true),
            'bank', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'bank' AND is_active = true)
        ),
        'fetched_at', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_all_payment_methods(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_all_payment_methods() IS 'Admin: Get all payment methods with stats';


--
-- Name: get_all_payment_methods_internal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_payment_methods_internal() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'success', true,
        'methods', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', pm.id,
                    'method_type', pm.method_type,
                    'method_name', pm.method_name,
                    'account_number', pm.account_number,
                    'account_holder_name', pm.account_holder_name,
                    'bank_name', pm.bank_name,
                    'is_active', pm.is_active,
                    'display_order', pm.display_order,
                    'created_at', pm.created_at,
                    'updated_at', pm.updated_at
                ) ORDER BY pm.display_order, pm.method_name
            )
            FROM payment_methods pm
        ), '[]'::json),
        'stats', json_build_object(
            'total', (SELECT COUNT(*) FROM payment_methods),
            'active', (SELECT COUNT(*) FROM payment_methods WHERE is_active = true),
            'inactive', (SELECT COUNT(*) FROM payment_methods WHERE is_active = false),
            'jazzcash', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'jazzcash' AND is_active = true),
            'easypaisa', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'easypaisa' AND is_active = true),
            'bank', (SELECT COUNT(*) FROM payment_methods WHERE method_type = 'bank' AND is_active = true)
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_all_perks_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_perks_settings() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT json_object_agg(setting_key, json_build_object(
            'value', setting_value,
            'description', description,
            'is_active', is_active,
            'updated_at', updated_at
        ))
        FROM perks_settings
        WHERE is_active = true
    );
END;
$$;


--
-- Name: get_all_review_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_review_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_all_reviews(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_reviews(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, order_id uuid, customer_id uuid, customer_name text, rating integer, comment text, images jsonb, is_visible boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id, r.order_id, r.customer_id,
        c.name as customer_name,
        r.rating, r.comment, r.images, r.is_visible, r.created_at
    FROM reviews r
    JOIN customers c ON c.id = r.customer_id
    ORDER BY r.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


--
-- Name: get_all_riders_analytics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_riders_analytics() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_employee_id UUID;
    v_employee_role TEXT;
BEGIN
    -- Get current employee
    v_employee_id := get_employee_id();
    
    -- Verify admin/manager role
    SELECT role INTO v_employee_role FROM employees WHERE id = v_employee_id;
    
    IF v_employee_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Return all riders analytics
    RETURN json_build_object(
        'success', true,
        'riders', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'rider_id', e.id,
                    'name', e.name,
                    'phone', e.phone,
                    'avatar_url', e.avatar_url,
                    'status', e.status,
                    'stats', (
                        SELECT json_build_object(
                            'total_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivered'),
                            'deliveries_today', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
                            'deliveries_this_week', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'),
                            'active_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivering'),
                            'avg_delivery_minutes', ROUND(AVG(actual_delivery_minutes) FILTER (WHERE actual_delivery_minutes IS NOT NULL)),
                            'avg_rating', ROUND(AVG(customer_rating) FILTER (WHERE customer_rating IS NOT NULL), 1),
                            'total_earnings', COALESCE(SUM(total) FILTER (WHERE delivery_status = 'delivered'), 0),
                            'cancelled_count', COUNT(*) FILTER (WHERE delivery_status = 'cancelled')
                        )
                        FROM delivery_history dh WHERE dh.rider_id = e.id
                    )
                ) ORDER BY e.name
            ), '[]'::json)
            FROM employees e
            WHERE e.role = 'delivery_rider'
              AND e.status = 'active'
        ),
        -- Overall stats
        'overall', (
            SELECT json_build_object(
                'total_deliveries_today', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
                'total_active', COUNT(*) FILTER (WHERE delivery_status = 'delivering'),
                'avg_delivery_time', ROUND(AVG(actual_delivery_minutes) FILTER (WHERE actual_delivery_minutes IS NOT NULL AND delivered_at::DATE = CURRENT_DATE)),
                'total_earnings_today', COALESCE(SUM(total) FILTER (WHERE delivery_status = 'delivered' AND delivered_at::DATE = CURRENT_DATE), 0)
            )
            FROM delivery_history
        )
    );
END;
$$;


--
-- Name: FUNCTION get_all_riders_analytics(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_all_riders_analytics() IS 'Manager function: Returns analytics for all delivery riders';


--
-- Name: get_all_site_content(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_site_content() RETURNS TABLE(id uuid, section text, content jsonb, is_active boolean, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT sc.id, sc.section, sc.content, sc.is_active, sc.updated_at
    FROM site_content sc
    ORDER BY sc.section;
END;
$$;


--
-- Name: get_all_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_tables() RETURNS TABLE(id uuid, table_number integer, capacity integer, status text, current_order_id uuid, order_number text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id, t.table_number, t.capacity, t.status, t.current_order_id,
        o.order_number
    FROM restaurant_tables t
    LEFT JOIN orders o ON o.id = t.current_order_id
    ORDER BY t.table_number;
END;
$$;


--
-- Name: get_all_users_for_maintenance_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_users_for_maintenance_email() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    customer_count INTEGER;
    employee_count INTEGER;
BEGIN
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized - not admin');
    END IF;
    
    -- Count for debugging
    SELECT COUNT(*) INTO customer_count FROM customers WHERE email IS NOT NULL AND email != '' AND is_banned = false;
    SELECT COUNT(*) INTO employee_count FROM employees WHERE email IS NOT NULL AND email != '' AND status = 'active' AND role != 'admin';
    
    SELECT json_build_object(
        'success', true,
        'debug', json_build_object('customer_count', customer_count, 'employee_count', employee_count),
        'customers', COALESCE((
            SELECT json_agg(json_build_object(
                'email', c.email,
                'name', COALESCE(c.name, 'Customer')
            ))
            FROM customers c
            WHERE c.email IS NOT NULL 
            AND c.email != ''
            AND c.is_banned = false
        ), '[]'::json),
        'employees', COALESCE((
            SELECT json_agg(json_build_object(
                'email', e.email,
                'name', COALESCE(e.name, 'Employee')
            ))
            FROM employees e
            WHERE e.email IS NOT NULL 
            AND e.email != ''
            AND e.status = 'active'
            AND e.role != 'admin'
        ), '[]'::json)
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_all_users_for_maintenance_email(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_all_users_for_maintenance_email() IS 'Admin: Get all user emails for notification';


--
-- Name: get_attendance_history(integer, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_attendance_history(p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT (EXTRACT(month FROM CURRENT_DATE))::integer, p_employee_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    start_date := make_date(p_year, p_month, 1);
    end_date := (start_date + INTERVAL '1 month')::DATE;
    
    SELECT json_build_object(
        'success', true,
        'month', to_char(start_date, 'YYYY-MM'),
        'attendance', COALESCE(json_agg(
            json_build_object(
                'id', a.id,
                'employee_id', a.employee_id,
                'date', a.date,
                'check_in', a.check_in,
                'check_out', a.check_out,
                'status', a.status,
                'notes', a.notes,
                'employee', json_build_object(
                    'id', e.id,
                    'employee_id', e.employee_id,
                    'name', e.name,
                    'email', e.email,
                    'phone', e.phone,
                    'avatar_url', e.avatar_url,
                    'role', e.role,
                    'status', e.status,
                    'hired_date', e.hired_date
                )
            ) ORDER BY a.date DESC, a.check_in DESC
        ), '[]'::json)
    ) INTO result
    FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id
    WHERE a.date >= start_date 
    AND a.date < end_date
    AND (p_employee_id IS NULL OR a.employee_id = p_employee_id);
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_attendance_history(p_year integer, p_month integer, p_employee_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_attendance_history(p_year integer, p_month integer, p_employee_id uuid) IS 'Returns attendance history for a month - admin/manager only';


--
-- Name: get_attendance_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_attendance_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    total_active INTEGER;
    present_count INTEGER;
    late_count INTEGER;
    on_leave_count INTEGER;
    absent_count INTEGER;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Get total active employees
    SELECT COUNT(*) INTO total_active
    FROM employees
    WHERE status = 'active';
    
    -- Get today's attendance counts
    SELECT 
        COUNT(*) FILTER (WHERE status = 'present'),
        COUNT(*) FILTER (WHERE status = 'late'),
        COUNT(*) FILTER (WHERE status = 'on_leave')
    INTO present_count, late_count, on_leave_count
    FROM attendance
    WHERE date = CURRENT_DATE;
    
    -- Calculate absent (total - all who marked attendance - on leave)
    absent_count := total_active - present_count - late_count - on_leave_count;
    IF absent_count < 0 THEN absent_count := 0; END IF;
    
    RETURN json_build_object(
        'success', true,
        'stats', json_build_object(
            'total', total_active,
            'present', present_count,
            'late', late_count,
            'on_leave', on_leave_count,
            'absent', absent_count,
            'attendance_rate', CASE WHEN total_active > 0 
                THEN ROUND(((present_count + late_count)::NUMERIC / total_active) * 100, 1)
                ELSE 0 
            END
        )
    );
END;
$$;


--
-- Name: FUNCTION get_attendance_stats(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_attendance_stats() IS 'Returns attendance stats for today - admin/manager only';


--
-- Name: get_attendance_summary_by_employee(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_attendance_summary_by_employee(p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT (EXTRACT(month FROM CURRENT_DATE))::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  start_date := make_date(p_year, p_month, 1);
  end_date := (start_date + INTERVAL '1 month')::DATE;
  
  SELECT json_build_object(
    'success', true,
    'month', to_char(start_date, 'YYYY-MM'),
    'summary', COALESCE(json_agg(
      json_build_object(
        'employee', json_build_object(
          'id', e.id,
          'employee_id', e.employee_id,
          'name', e.name,
          'role', e.role,
          'avatar_url', e.avatar_url
        ),
        'present_days', COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0),
        'late_days', COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0),
        'absent_days', COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0),
        'leave_days', COALESCE(SUM(CASE WHEN a.status = 'on_leave' THEN 1 ELSE 0 END), 0),
        'half_days', COALESCE(SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END), 0),
        'total_hours', COALESCE(ROUND(SUM(
          EXTRACT(EPOCH FROM (COALESCE(a.check_out, NOW()) - a.check_in)) / 3600
        )::NUMERIC, 1), 0)
      )
    ), '[]'::json)
  ) INTO result
  FROM employees e
  LEFT JOIN attendance a ON a.employee_id = e.id 
    AND a.date >= start_date 
    AND a.date < end_date
  WHERE e.status = 'active'
  GROUP BY e.id, e.employee_id, e.name, e.role, e.avatar_url
  ORDER BY e.name;
  
  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_attendance_summary_by_employee(p_year integer, p_month integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_attendance_summary_by_employee(p_year integer, p_month integer) IS 'Get monthly attendance summary per employee - admin/manager';


--
-- Name: get_attendance_summary_by_employee(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_attendance_summary_by_employee(p_caller_id uuid, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_month integer DEFAULT (EXTRACT(month FROM CURRENT_DATE))::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  result JSON;
BEGIN
  IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  
  start_date := make_date(p_year, p_month, 1);
  end_date := (start_date + INTERVAL '1 month')::DATE;
  
  SELECT json_build_object(
    'success', true,
    'month', to_char(start_date, 'YYYY-MM'),
    'summary', COALESCE(json_agg(
      json_build_object(
        'employee', json_build_object('id', e.id, 'employee_id', e.employee_id, 'name', e.name, 'role', e.role, 'avatar_url', e.avatar_url),
        'present_days', COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0),
        'late_days', COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0),
        'absent_days', COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0),
        'leave_days', COALESCE(SUM(CASE WHEN a.status = 'on_leave' THEN 1 ELSE 0 END), 0),
        'half_days', COALESCE(SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END), 0),
        'total_hours', COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(a.check_out, NOW()) - a.check_in)) / 3600)::NUMERIC, 1), 0)
      )
    ), '[]'::json)
  ) INTO result
  FROM employees e
  LEFT JOIN attendance a ON a.employee_id = e.id AND a.date >= start_date AND a.date < end_date
  WHERE e.status = 'active'
  GROUP BY e.id, e.employee_id, e.name, e.role, e.avatar_url
  ORDER BY e.name;
  
  RETURN result;
END;
$$;


--
-- Name: get_audit_logs(date, date, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_audit_logs(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_employee_id uuid DEFAULT NULL::uuid, p_action_type text DEFAULT NULL::text, p_limit integer DEFAULT 100) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'id', a.id,
            'action', a.action,
            'table_name', a.table_name,
            'record_id', a.record_id,
            'old_values', a.old_values,
            'new_values', a.new_values,
            'employee', (
                SELECT json_build_object('id', e.id, 'name', e.name, 'role', e.role)
                FROM employees e WHERE e.id = a.performed_by
            ),
            'ip_address', a.ip_address,
            'user_agent', a.user_agent,
            'created_at', a.created_at
        )
        ORDER BY a.created_at DESC
    ) INTO result
    FROM audit_logs a
    WHERE (p_start_date IS NULL OR DATE(a.created_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(a.created_at) <= p_end_date)
    AND (p_employee_id IS NULL OR a.performed_by = p_employee_id)
    AND (p_action_type IS NULL OR a.action = p_action_type)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_available_delivery_riders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_available_delivery_riders() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', e.id,
            'name', e.name,
            'phone', e.phone,
            'employee_id', e.employee_id,
            'avatar_url', e.avatar_url,
            'status', e.status,
            -- Count of current active deliveries
            'active_deliveries', (
                SELECT COUNT(*) FROM orders o 
                WHERE o.delivery_rider_id = e.id 
                AND o.status = 'delivering'
            ),
            -- Last delivery completed at
            'last_delivery_at', (
                SELECT MAX(delivered_at) FROM orders o 
                WHERE o.delivery_rider_id = e.id 
                AND o.status = 'delivered'
            ),
            -- Total deliveries today
            'deliveries_today', (
                SELECT COUNT(*) FROM orders o 
                WHERE o.delivery_rider_id = e.id 
                AND o.status = 'delivered'
                AND o.delivered_at::DATE = CURRENT_DATE
            )
        ) ORDER BY 
            -- Prioritize riders with fewer active deliveries
            (SELECT COUNT(*) FROM orders o WHERE o.delivery_rider_id = e.id AND o.status = 'delivering'),
            e.name
    ), '[]'::json) INTO result
    FROM employees e
    WHERE e.role::TEXT = 'delivery_rider'
      AND e.status = 'active'
      AND e.portal_enabled = true;
    
    RETURN result;
END;
$$;


--
-- Name: get_billable_orders(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_billable_orders(p_order_type text DEFAULT NULL::text, p_status_filter text DEFAULT 'all'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    v_employee_id UUID;
BEGIN
    -- Try to get employee ID (fallback if auth_user_id not set)
    v_employee_id := (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
    IF v_employee_id IS NULL THEN
        v_employee_id := (SELECT id FROM employees WHERE role::TEXT IN ('admin', 'manager') AND status = 'active' LIMIT 1);
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'orders', COALESCE((
            SELECT json_agg(order_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'order_type', o.order_type,
                    'status', o.status,
                    'payment_status', o.payment_status,
                    'customer_id', o.customer_id,
                    'customer_name', COALESCE(o.customer_name, 'Walk-in Customer'),
                    'customer_phone', o.customer_phone,
                    'customer_email', o.customer_email,
                    'customer_address', o.customer_address,
                    'items', o.items,
                    'items_count', jsonb_array_length(o.items),
                    'subtotal', o.subtotal,
                    'discount', o.discount,
                    'tax', o.tax,
                    'delivery_fee', o.delivery_fee,
                    'total', o.total,
                    'table_number', o.table_number,
                    'waiter_id', o.waiter_id,
                    'waiter_name', (SELECT name FROM employees WHERE id = o.waiter_id),
                    'notes', o.notes,
                    'created_at', o.created_at,
                    'payment_method', o.payment_method,
                    'transaction_id', o.transaction_id,
                    'online_payment_method_id', o.online_payment_method_id,
                    'online_payment_details', o.online_payment_details,
                    'is_registered_customer', o.customer_id IS NOT NULL,
                    'customer_loyalty_points', COALESCE((
                        SELECT SUM(points) FROM loyalty_points WHERE customer_id = o.customer_id
                    ), 0),
                    'has_invoice', EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
                ) as order_data,
                o.created_at
                FROM orders o
                WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
                AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
                AND (
                    p_status_filter = 'all' OR
                    (p_status_filter = 'pending_bill' AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)) OR
                    (p_status_filter = 'billed' AND EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id))
                )
                ORDER BY o.created_at DESC
                LIMIT p_limit
                OFFSET p_offset
            ) sub
        ), '[]'::json),
        'stats', (
            SELECT json_build_object(
                'total_pending', COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)),
                'total_billed_today', (
                    SELECT COUNT(*) FROM invoices WHERE DATE(created_at) = CURRENT_DATE
                ),
                'revenue_today', (
                    SELECT COALESCE(SUM(total), 0) FROM invoices WHERE DATE(created_at) = CURRENT_DATE AND bill_status = 'paid'
                )
            )
            FROM orders o
            WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_billable_orders(p_order_type text, p_status_filter text, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_billable_orders(p_order_type text, p_status_filter text, p_limit integer, p_offset integer) IS 'Returns all orders ready for billing with filters';


--
-- Name: get_billing_dashboard_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_billing_dashboard_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- No authorization check - protected by RLS and frontend auth
    RETURN json_build_object(
        'success', true,
        'today', (
            SELECT json_build_object(
                'total_revenue', COALESCE(SUM(total), 0),
                'invoices_count', COUNT(*),
                'cash_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash'), 0),
                'card_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0),
                'online_revenue', COALESCE(SUM(total) FILTER (WHERE payment_method = 'online'), 0),
                'avg_invoice_value', ROUND(AVG(total), 2),
                'total_discount_given', COALESCE(SUM(discount), 0),
                'total_tips', COALESCE(SUM(tip), 0),
                'dine_in_count', COUNT(*) FILTER (WHERE order_type = 'dine-in'),
                'online_count', COUNT(*) FILTER (WHERE order_type = 'online'),
                'walk_in_count', COUNT(*) FILTER (WHERE order_type = 'walk-in')
            )
            FROM invoices
            WHERE DATE(created_at) = CURRENT_DATE
            AND bill_status = 'paid'
        ),
        'this_week', (
            SELECT json_build_object(
                'total_revenue', COALESCE(SUM(daily_total), 0),
                'invoices_count', COALESCE(SUM(daily_count), 0),
                'avg_daily_revenue', ROUND(AVG(daily_total), 2)
            )
            FROM (
                SELECT DATE(created_at) as day, SUM(total) as daily_total, COUNT(*) as daily_count
                FROM invoices
                WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
                AND bill_status = 'paid'
                GROUP BY DATE(created_at)
            ) daily
        ),
        'pending_orders', (
            SELECT COUNT(*)
            FROM orders o
            WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
        ),
        'recent_invoices', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', i.id,
                    'invoice_number', i.invoice_number,
                    'customer_name', i.customer_name,
                    'total', i.total,
                    'payment_method', i.payment_method,
                    'created_at', i.created_at
                ) ORDER BY i.created_at DESC
            ), '[]'::json)
            FROM (
                SELECT * FROM invoices
                WHERE DATE(created_at) = CURRENT_DATE
                ORDER BY created_at DESC
                LIMIT 5
            ) i
        )
    );
END;
$$;


--
-- Name: FUNCTION get_billing_dashboard_stats(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_billing_dashboard_stats() IS 'Returns billing dashboard statistics';


--
-- Name: get_billing_dashboard_stats_enhanced(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_billing_dashboard_stats_enhanced(p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_bills', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'total_amount', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'cash_amount', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND payment_method = 'cash'
        AND status = 'delivered'
    ), 0),
    'card_amount', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND payment_method = 'card'
        AND status = 'delivered'
    ), 0),
    'online_amount', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND payment_method IN ('online', 'upi', 'wallet')
        AND status = 'delivered'
    ), 0),
    'pending_bills', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE status = 'ready'
    ), 0),
    'avg_bill_amount', COALESCE((
      SELECT AVG(total)
      FROM orders
      WHERE DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status IN ('completed', 'delivered')
    ), 0),
    'date_range', json_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;


--
-- Name: get_billing_pending_orders(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_billing_pending_orders(p_limit integer DEFAULT 10) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN json_build_object(
        'success', true,
        'orders', COALESCE((
            SELECT json_agg(order_data ORDER BY created_at DESC)
            FROM (
                SELECT json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'order_type', o.order_type,
                    'status', o.status,
                    'customer_name', COALESCE(o.customer_name, 'Walk-in Customer'),
                    'customer_phone', o.customer_phone,
                    'items', o.items,
                    'items_count', jsonb_array_length(COALESCE(o.items, '[]'::jsonb)),
                    'total', o.total,
                    'table_number', o.table_number,
                    'waiter_name', (SELECT name FROM employees WHERE id = o.waiter_id),
                    'created_at', o.created_at,
                    'payment_method', o.payment_method,
                    'transaction_id', o.transaction_id,
                    'online_payment_details', o.online_payment_details,
                    'is_registered_customer', o.customer_id IS NOT NULL,
                    'customer_loyalty_points', COALESCE((
                        SELECT SUM(points)::INT FROM loyalty_points WHERE customer_id = o.customer_id
                    ), 0)
                ) as order_data,
                o.created_at
                FROM orders o
                WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
                AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
                ORDER BY o.created_at DESC
                LIMIT p_limit
            ) sub
        ), '[]'::json),
        'pending_count', (
            SELECT COUNT(*)::INT
            FROM orders o
            WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
        ),
        'online_orders_count', (
            SELECT COUNT(*)::INT
            FROM orders o
            WHERE o.order_type = 'online'
            AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
            AND NOT EXISTS (SELECT 1 FROM invoices WHERE order_id = o.id)
        )
    );
END;
$$;


--
-- Name: FUNCTION get_billing_pending_orders(p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_billing_pending_orders(p_limit integer) IS 'Optimized function for billing dashboard pending orders';


--
-- Name: get_billing_stats(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_billing_stats(p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_bills', COALESCE((
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status = 'delivered'
        ), 0),
        'total_amount', COALESCE((
            SELECT SUM(total)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status = 'delivered'
        ), 0),
        'cash_amount', COALESCE((
            SELECT SUM(total)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND payment_method = 'cash'
              AND status = 'delivered'
        ), 0),
        'card_amount', COALESCE((
            SELECT SUM(total)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND payment_method = 'card'
              AND status = 'delivered'
        ), 0),
        'online_amount', COALESCE((
            SELECT SUM(total)
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND payment_method IN ('online', 'upi', 'wallet')
              AND status = 'delivered'
        ), 0),
        'pending_bills', COALESCE((
            SELECT COUNT(*)
            FROM orders
            WHERE status = 'ready'
        ), 0),
        'date_range', json_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_category_sales_report(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_category_sales_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- Check authorization - allow server-side calls (auth.uid() is null)
    IF auth.uid() IS NULL THEN
        v_is_authorized := TRUE;
    ELSE
        v_is_authorized := EXISTS (
            SELECT 1 FROM employees 
            WHERE auth_user_id = auth.uid() 
            AND status = 'active'
            AND role IN ('admin', 'manager')
        );
    END IF;
    
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'category', mc.name,
            'category_id', mc.id,
            'total_sales', COALESCE(sales.total, 0),
            'order_count', COALESCE(sales.order_count, 0),
            'items_sold', COALESCE(sales.items_sold, 0)
        )
        ORDER BY sales.total DESC NULLS LAST
    ) INTO result
    FROM menu_categories mc
    LEFT JOIN LATERAL (
        SELECT 
            SUM((item->>'subtotal')::decimal) as total,
            COUNT(DISTINCT o.id) as order_count,
            SUM((item->>'quantity')::int) as items_sold
        FROM orders o,
        jsonb_array_elements(o.items) as item
        JOIN menu_items mi ON mi.id = (item->>'id')::uuid
        WHERE mi.category_id = mc.id
        AND o.status NOT IN ('cancelled')
        AND (p_start_date IS NULL OR DATE(o.created_at) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(o.created_at) <= p_end_date)
    ) sales ON true;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_category_sales_report_v2(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_category_sales_report_v2(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'category', mc.name,
            'category_id', mc.id,
            'total_sales', COALESCE(sales.total, 0),
            'order_count', COALESCE(sales.order_count, 0),
            'items_sold', COALESCE(sales.items_sold, 0)
        )
        ORDER BY sales.total DESC NULLS LAST
    ) INTO result
    FROM menu_categories mc
    LEFT JOIN LATERAL (
        SELECT 
            SUM(
                COALESCE((item->>'subtotal')::decimal, 
                    (item->>'price')::decimal * COALESCE((item->>'quantity')::int, 1))
            ) as total,
            COUNT(DISTINCT o.id) as order_count,
            SUM(COALESCE((item->>'quantity')::int, 1)) as items_sold
        FROM orders o,
        jsonb_array_elements(o.items) as item
        JOIN menu_items mi ON mi.id = COALESCE(
            (item->>'menu_item_id')::uuid,
            (item->>'id')::uuid
        )
        WHERE mi.category_id = mc.id
        AND o.status NOT IN ('cancelled')
        AND (p_start_date IS NULL OR DATE(o.created_at) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(o.created_at) <= p_end_date)
    ) sales ON true;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_contact_message_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contact_message_by_id(p_message_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_contact_message_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contact_message_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_contact_messages_advanced(text, text, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contact_messages_advanced(p_status text DEFAULT 'all'::text, p_sort_by text DEFAULT 'recent'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_customer_by_auth_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_by_auth_id(p_auth_user_id uuid) RETURNS TABLE(id uuid, auth_user_id uuid, name text, email text, phone text, address text, is_verified boolean, is_2fa_enabled boolean, favorites jsonb, is_banned boolean, ban_reason text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.auth_user_id,
    c.name::text,
    c.email::text,
    c.phone::text,
    c.address::text,
    c.is_verified,
    c.is_2fa_enabled,
    c.favorites,
    COALESCE(c.is_banned, false) as is_banned,
    c.ban_reason::text,
    c.created_at,
    c.updated_at
  FROM customers c
  WHERE c.auth_user_id = p_auth_user_id
  LIMIT 1;
END;
$$;


--
-- Name: get_customer_detail_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_detail_admin(p_customer_id uuid) RETURNS TABLE(customer_id uuid, customer_name text, customer_email text, customer_phone text, customer_address text, is_verified boolean, is_banned boolean, ban_reason text, banned_at timestamp with time zone, banned_by_name text, unbanned_at timestamp with time zone, unbanned_by_name text, created_at timestamp with time zone, favorites jsonb, total_orders bigint, total_spending numeric, average_order_value numeric, online_orders bigint, dine_in_orders bigint, takeaway_orders bigint, loyalty_points integer, lifetime_points integer, total_invoices bigint, total_invoice_amount numeric, recent_orders jsonb, recent_invoices jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS customer_id,
        c.name::TEXT AS customer_name,
        c.email::TEXT AS customer_email,
        c.phone::TEXT AS customer_phone,
        c.address::TEXT AS customer_address,
        c.is_verified,
        COALESCE(c.is_banned, false) AS is_banned,
        c.ban_reason::TEXT,
        c.banned_at,
        banned_emp.name::TEXT AS banned_by_name,
        c.unbanned_at,
        unbanned_emp.name::TEXT AS unbanned_by_name,
        c.created_at,
        COALESCE(c.favorites, '[]'::jsonb) AS favorites,
        -- Order statistics
        COALESCE(os.total_orders, 0) AS total_orders,
        COALESCE(os.total_spending, 0) AS total_spending,
        COALESCE(os.avg_order, 0) AS average_order_value,
        COALESCE(os.online_orders, 0) AS online_orders,
        COALESCE(os.dine_in_orders, 0) AS dine_in_orders,
        COALESCE(os.takeaway_orders, 0) AS takeaway_orders,
        -- Loyalty
        COALESCE(lp.current_points, 0)::INTEGER AS loyalty_points,
        COALESCE(lp.lifetime_points, 0)::INTEGER AS lifetime_points,
        -- Invoice stats
        COALESCE(inv.total_invoices, 0) AS total_invoices,
        COALESCE(inv.total_invoice_amount, 0) AS total_invoice_amount,
        -- Recent orders (last 10)
        COALESCE(ro.orders, '[]'::jsonb) AS recent_orders,
        -- Recent invoices (last 10)
        COALESCE(ri.invoices, '[]'::jsonb) AS recent_invoices
    FROM customers c
    LEFT JOIN employees banned_emp ON c.banned_by = banned_emp.id
    LEFT JOIN employees unbanned_emp ON c.unbanned_by = unbanned_emp.id
    -- Order stats
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_orders,
            SUM(total) AS total_spending,
            AVG(total) AS avg_order,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'online') AS online_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'dine-in') AS dine_in_orders,
            COUNT(*) FILTER (WHERE order_type::TEXT = 'walk-in') AS takeaway_orders
        FROM orders o
        WHERE o.customer_id = c.id
    ) os ON true
    -- Loyalty points
    LEFT JOIN LATERAL (
        SELECT 
            SUM(lpt.points) AS current_points,
            SUM(ABS(lpt.points)) AS lifetime_points
        FROM loyalty_points lpt
        WHERE lpt.customer_id = c.id
    ) lp ON true
    -- Invoice stats
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) AS total_invoices,
            SUM(cir.total) AS total_invoice_amount
        FROM customer_invoice_records cir
        WHERE cir.customer_id = c.id
    ) inv ON true
    -- Recent orders
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'status', o.status,
                'total', o.total,
                'items', o.items,
                'payment_method', o.payment_method,
                'created_at', o.created_at
            ) ORDER BY o.created_at DESC
        ) AS orders
        FROM (
            SELECT ord.* FROM orders ord
            WHERE ord.customer_id = c.id 
            ORDER BY ord.created_at DESC 
            LIMIT 10
        ) o
    ) ro ON true
    -- Recent invoices
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', i.id,
                'invoice_number', i.invoice_number,
                'order_type', i.order_type,
                'total', i.total,
                'payment_method', i.payment_method,
                'loyalty_points_earned', i.loyalty_points_earned,
                'billed_at', i.billed_at
            ) ORDER BY i.billed_at DESC
        ) AS invoices
        FROM (
            SELECT cir.* FROM customer_invoice_records cir
            WHERE cir.customer_id = c.id 
            ORDER BY cir.billed_at DESC 
            LIMIT 10
        ) i
    ) ri ON true
    WHERE c.id = p_customer_id;
END;
$$;


--
-- Name: get_customer_favorites(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_favorites(p_customer_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: get_customer_invoice_history(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_invoice_history(p_customer_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_customer RECORD;
    v_invoices JSON;
    v_stats JSON;
BEGIN
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
    
    IF v_customer IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    -- Get invoices
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', i.id,
            'invoice_number', i.invoice_number,
            'order_type', i.order_type,
            'items_count', jsonb_array_length(i.items),
            'subtotal', i.subtotal,
            'discount', i.discount,
            'total', i.total,
            'payment_method', i.payment_method,
            'created_at', i.created_at,
            'loyalty_points_earned', i.loyalty_points_earned
        ) ORDER BY i.created_at DESC
    ), '[]'::json)
    INTO v_invoices
    FROM invoices i
    WHERE i.customer_id = p_customer_id
    AND i.bill_status = 'paid';
    
    -- Get stats
    SELECT json_build_object(
        'total_invoices', COUNT(*),
        'total_spent', COALESCE(SUM(total), 0),
        'average_order', ROUND(AVG(total), 2),
        'total_points_earned', COALESCE(SUM(loyalty_points_earned), 0),
        'total_discounts', COALESCE(SUM(discount), 0),
        'favorite_payment', (
            SELECT payment_method 
            FROM invoices 
            WHERE customer_id = p_customer_id 
            GROUP BY payment_method 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        )
    )
    INTO v_stats
    FROM invoices
    WHERE customer_id = p_customer_id
    AND bill_status = 'paid';
    
    RETURN json_build_object(
        'success', true,
        'customer', json_build_object(
            'id', v_customer.id,
            'name', v_customer.name,
            'phone', v_customer.phone,
            'email', v_customer.email,
            'loyalty_tier', CASE 
                WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = v_customer.id), 0) >= 1000 THEN 'platinum'
                WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = v_customer.id), 0) >= 500 THEN 'gold'
                WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = v_customer.id), 0) >= 250 THEN 'silver'
                ELSE 'bronze'
            END,
            'loyalty_points', COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = v_customer.id), 0)
        ),
        'stats', v_stats,
        'invoices', v_invoices
    );
END;
$$;


--
-- Name: FUNCTION get_customer_invoice_history(p_customer_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_customer_invoice_history(p_customer_id uuid) IS 'Returns invoice history for registered customer';


--
-- Name: get_customer_loyalty_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_loyalty_summary(p_customer_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_summary RECORD;
    v_recent_points JSON;
    v_available_promos JSON;
BEGIN
    -- Get summary
    SELECT * INTO v_summary FROM customer_loyalty_summary WHERE customer_id = p_customer_id;
    
    -- Get recent points activity
    SELECT COALESCE(json_agg(lp), '[]'::json)
    INTO v_recent_points
    FROM (
        SELECT points, type, description, created_at
        FROM loyalty_points
        WHERE customer_id = p_customer_id
        ORDER BY created_at DESC
        LIMIT 10
    ) lp;
    
    -- Get available promos
    SELECT COALESCE(json_agg(cp), '[]'::json)
    INTO v_available_promos
    FROM (
        SELECT code, name, promo_type, value, max_discount, expires_at
        FROM customer_promo_codes
        WHERE customer_id = p_customer_id 
        AND is_active = true 
        AND is_used = false 
        AND expires_at > NOW()
    ) cp;
    
    RETURN json_build_object(
        'customer_id', p_customer_id,
        'customer_name', v_summary.customer_name,
        'total_points', COALESCE(v_summary.total_points, 0),
        'earned_points', COALESCE(v_summary.earned_points, 0),
        'redeemed_points', COALESCE(v_summary.redeemed_points, 0),
        'bonus_points', COALESCE(v_summary.bonus_points, 0),
        'orders_with_points', COALESCE(v_summary.orders_with_points, 0),
        'last_activity', v_summary.last_points_activity,
        'recent_points', v_recent_points,
        'available_promos', v_available_promos
    );
END;
$$;


--
-- Name: get_customer_orders(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_orders(p_customer_id uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, order_number text, status public.order_status, order_type public.order_type, total numeric, created_at timestamp with time zone, items jsonb, item_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number,
        o.status,
        o.order_type,
        o.total,
        o.created_at,
        o.items,
        jsonb_array_length(o.items) as item_count
    FROM orders o
    WHERE o.customer_id = p_customer_id
    ORDER BY o.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


--
-- Name: get_customer_orders_paginated(uuid, integer, integer, public.order_status); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_orders_paginated(p_customer_id uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0, p_status public.order_status DEFAULT NULL::public.order_status) RETURNS TABLE(id uuid, order_number text, items jsonb, total numeric, status public.order_status, payment_method public.payment_method, payment_status text, customer_address text, created_at timestamp with time zone, delivered_at timestamp with time zone, assigned_to_name text, assigned_to_phone text, transaction_id text, online_payment_method_id uuid, online_payment_details jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number::TEXT,
        o.items,
        o.total,
        o.status,
        o.payment_method,
        o.payment_status::TEXT,
        o.customer_address,
        o.created_at,
        o.delivered_at,
        e.name::TEXT,
        e.phone::TEXT,
        o.transaction_id,
        o.online_payment_method_id,
        o.online_payment_details
    FROM orders o
    LEFT JOIN employees e ON o.assigned_to = e.id
    WHERE o.customer_id = p_customer_id
        AND (p_status IS NULL OR o.status = p_status)
    ORDER BY o.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


--
-- Name: FUNCTION get_customer_orders_paginated(p_customer_id uuid, p_limit integer, p_offset integer, p_status public.order_status); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_customer_orders_paginated(p_customer_id uuid, p_limit integer, p_offset integer, p_status public.order_status) IS 'Get customer orders with pagination and online payment details';


--
-- Name: get_customer_payment_history(uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_payment_history(p_customer_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_payment_type text DEFAULT NULL::text) RETURNS TABLE(id uuid, order_number text, order_type public.order_type, total numeric, subtotal numeric, tax numeric, delivery_fee numeric, discount numeric, payment_method public.payment_method, payment_status text, transaction_id text, online_payment_method_name text, online_payment_account_holder text, online_payment_account_number text, online_payment_bank_name text, created_at timestamp with time zone, delivered_at timestamp with time zone, table_number text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number::TEXT,
        o.order_type,
        o.total,
        o.subtotal,
        o.tax,
        o.delivery_fee,
        o.discount,
        o.payment_method,
        o.payment_status::TEXT,
        o.transaction_id,
        COALESCE(
            (o.online_payment_details->>'method_name')::TEXT,
            pm.method_name
        ),
        COALESCE(
            (o.online_payment_details->>'account_holder_name')::TEXT,
            pm.account_holder_name
        ),
        COALESCE(
            (o.online_payment_details->>'account_number')::TEXT,
            pm.account_number
        ),
        COALESCE(
            (o.online_payment_details->>'bank_name')::TEXT,
            pm.bank_name
        ),
        o.created_at,
        o.delivered_at,
        o.table_number
    FROM orders o
    LEFT JOIN payment_methods pm ON o.online_payment_method_id = pm.id
    WHERE o.customer_id = p_customer_id
        AND (
            p_payment_type IS NULL
            OR (p_payment_type = 'online' AND o.payment_method NOT IN ('cash_on_delivery'))
            OR (p_payment_type = 'cash' AND o.payment_method = 'cash_on_delivery')
            OR (p_payment_type = 'dine_in' AND o.order_type = 'dine_in')
        )
    ORDER BY o.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


--
-- Name: FUNCTION get_customer_payment_history(p_customer_id uuid, p_limit integer, p_offset integer, p_payment_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_customer_payment_history(p_customer_id uuid, p_limit integer, p_offset integer, p_payment_type text) IS 'Get customer payment history timeline with transaction details';


--
-- Name: get_customer_promo_codes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_promo_codes(p_customer_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT COALESCE(json_agg(row_to_json(cp)), '[]'::json)
        FROM (
            SELECT 
                id, code, promo_type, value, max_discount, name, description,
                loyalty_points_required, is_used, used_at, expires_at, is_active, created_at,
                CASE WHEN expires_at < NOW() THEN true ELSE false END as is_expired
            FROM customer_promo_codes
            WHERE customer_id = p_customer_id
            ORDER BY created_at DESC
        ) cp
    );
END;
$$;


--
-- Name: get_customer_reviews(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_reviews(p_customer_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_customer_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_stats(p_customer_id uuid) RETURNS TABLE(total_orders integer, total_spent numeric, average_order_value numeric, loyalty_points integer, favorite_items jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT o.id)::INT,
        COALESCE(SUM(o.total), 0),
        COALESCE(AVG(o.total), 0),
        COALESCE((SELECT SUM(CASE WHEN type = 'earned' THEN points ELSE -points END)::INT 
                  FROM loyalty_points WHERE customer_id = p_customer_id), 0),
        (
            SELECT jsonb_agg(
                jsonb_build_object('item_id', item_id, 'name', item_name, 'count', item_count)
            )
            FROM (
                SELECT 
                    (item->>'id')::UUID as item_id,
                    item->>'name' as item_name,
                    COUNT(*) as item_count
                FROM orders o2,
                     jsonb_array_elements(o2.items) as item
                WHERE o2.customer_id = p_customer_id
                    AND o2.status = 'delivered'
                GROUP BY item->>'id', item->>'name'
                ORDER BY item_count DESC
                LIMIT 5
            ) top_items
        )
    FROM orders o
    WHERE o.customer_id = p_customer_id
        AND o.status = 'delivered';
END;
$$;


--
-- Name: get_customers_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customers_stats() RETURNS TABLE(total_customers bigint, active_customers bigint, banned_customers bigint, verified_customers bigint, customers_this_month bigint, total_spending numeric, average_order_value numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_customers,
        COUNT(*) FILTER (WHERE c.is_banned IS NULL OR c.is_banned = false)::BIGINT AS active_customers,
        COUNT(*) FILTER (WHERE c.is_banned = true)::BIGINT AS banned_customers,
        COUNT(*) FILTER (WHERE c.is_verified = true)::BIGINT AS verified_customers,
        COUNT(*) FILTER (WHERE c.created_at >= date_trunc('month', NOW()))::BIGINT AS customers_this_month,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id IS NOT NULL) AS total_spending,
        (SELECT COALESCE(AVG(total), 0) FROM orders WHERE customer_id IS NOT NULL) AS average_order_value
    FROM customers c;
END;
$$;


--
-- Name: get_deal_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_deal_by_id(p_deal_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'code', p.code,
        'discount_type', 
            CASE 
                WHEN p.promo_type::text = 'fixed_amount' THEN 'fixed'
                WHEN p.promo_type::text = 'free_item' THEN 'bogo'
                ELSE 'percentage'
            END,
        'discount_value', p.value,
        'min_order_amount', p.min_order_amount,
        'max_discount', p.max_discount,
        'start_date', p.valid_from,
        'end_date', p.valid_until,
        'usage_limit', p.usage_limit,
        'used_count', COALESCE(p.current_usage, 0),
        'is_active', p.is_active,
        'created_at', p.created_at
    ) INTO result
    FROM promo_codes p
    WHERE p.id = p_deal_id;
    
    RETURN result;
END;
$$;


--
-- Name: get_deal_with_items(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_deal_with_items(p_deal_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', d.id, 'name', d.name, 'description', d.description, 'code', d.code, 'deal_type', d.deal_type,
        'original_price', d.original_price, 'discounted_price', d.discounted_price, 'discount_percentage', d.discount_percentage,
        'image_url', d.image_url, 'valid_from', d.valid_from, 'valid_until', d.valid_until,
        'usage_limit', d.usage_limit, 'usage_count', d.usage_count, 'is_active', d.is_active, 'is_featured', d.is_featured, 'created_at', d.created_at,
        'items', COALESCE((
            SELECT json_agg(json_build_object('id', m.id, 'name', m.name, 'price', m.price, 'quantity', di.quantity, 'image', m.images->0))
            FROM deal_items di JOIN menu_items m ON m.id = di.menu_item_id WHERE di.deal_id = d.id
        ), '[]'::json)
    ) INTO result FROM deals d WHERE d.id = p_deal_id;
    RETURN result;
END;
$$;


--
-- Name: get_deals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_deals() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'code', p.code,
            'discount_type', p.promo_type,
            'discount_value', p.value,
            'min_order_amount', p.min_order_amount,
            'max_discount', p.max_discount,
            'start_date', p.valid_from,
            'end_date', p.valid_until,
            'usage_limit', p.usage_limit,
            'used_count', p.current_usage,
            'is_active', p.is_active,
            'created_at', p.created_at
        )
        ORDER BY p.created_at DESC
    ) INTO result
    FROM promo_codes p;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_delivery_orders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_delivery_orders() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    emp_role TEXT;
    result JSON;
BEGIN
    emp_id := get_employee_id();
    emp_role := get_employee_role();
    
    SELECT json_agg(
        json_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'customer_name', o.customer_name,
            'customer_phone', o.customer_phone,
            'customer_address', o.customer_address,
            'items', o.items,
            'total', o.total,
            'status', o.status,
            'payment_status', o.payment_status,
            'delivery_started_at', o.delivery_started_at,
            'estimated_delivery_time', o.estimated_delivery_time,
            'created_at', o.created_at
        )
        ORDER BY o.created_at DESC
    ) INTO result
    FROM orders o
    WHERE o.order_type = 'online'
    AND (
        emp_role IN ('admin', 'manager') OR 
        o.delivery_rider_id = emp_id OR
        (o.delivery_rider_id IS NULL AND o.status = 'ready')
    )
    AND o.status IN ('ready', 'delivering');
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_employee_analytics(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_analytics(p_employee_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'employee', (
            SELECT row_to_json(e.*)
            FROM employees e
            WHERE e.id = p_employee_id
        ),
        'attendance_this_month', (
            SELECT json_build_object(
                'present_days', COUNT(*) FILTER (WHERE status = 'present'),
                'late_days', COUNT(*) FILTER (WHERE status = 'late'),
                'absent_days', COUNT(*) FILTER (WHERE status = 'absent'),
                'total_hours', SUM(hours_worked)
            )
            FROM attendance
            WHERE employee_id = p_employee_id
            AND date >= date_trunc('month', CURRENT_DATE)
        ),
        'orders_this_month', (
            SELECT COUNT(*)
            FROM orders
            WHERE (waiter_id = p_employee_id OR assigned_to = p_employee_id)
            AND created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'tips_this_month', (
            SELECT COALESCE(SUM(tip_amount), 0)
            FROM waiter_tips
            WHERE waiter_id = p_employee_id
            AND date >= date_trunc('month', CURRENT_DATE)
        ),
        'recent_orders', (
            SELECT json_agg(
                json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'total', o.total,
                    'status', o.status,
                    'created_at', o.created_at
                )
                ORDER BY o.created_at DESC
            )
            FROM (
                SELECT * FROM orders
                WHERE waiter_id = p_employee_id OR assigned_to = p_employee_id
                ORDER BY created_at DESC
                LIMIT 10
            ) o
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_employee_block_status(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_block_status(p_email text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_employee RECORD;
BEGIN
  SELECT id, name, status::TEXT, portal_enabled, block_reason
  INTO v_employee
  FROM employees 
  WHERE email = p_email;

  IF v_employee IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  IF v_employee.status = 'blocked' THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_blocked', true,
      'block_reason', COALESCE(v_employee.block_reason, 'Your account has been blocked. Contact administrator.'),
      'portal_enabled', false
    );
  END IF;

  IF NOT v_employee.portal_enabled THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_blocked', false,
      'portal_enabled', false,
      'message', 'Portal access is disabled for your account.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_blocked', false,
    'portal_enabled', true
  );
END;
$$;


--
-- Name: get_employee_block_status_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_block_status_by_id(p_employee_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'is_blocked', COALESCE(is_blocked, false),
    'block_reason', block_reason
  ) INTO result
  FROM employees
  WHERE id = p_employee_id;

  IF result IS NULL THEN
    RETURN jsonb_build_object('is_blocked', false, 'block_reason', null);
  END IF;

  RETURN result;
END;
$$;


--
-- Name: get_employee_by_auth_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_by_auth_user(p_auth_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_employee_id UUID;
  v_result JSONB;
BEGIN
  -- Get employee ID from auth_user_id
  SELECT id INTO v_employee_id
  FROM employees
  WHERE auth_user_id = p_auth_user_id;

  -- If employee not found, return null
  IF v_employee_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Use the existing get_employee_complete function
  SELECT get_employee_complete(v_employee_id) INTO v_result;

  RETURN v_result;
END;
$$;


--
-- Name: get_employee_complete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_complete(p_employee_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    -- Core employee data
    'id', e.id,
    'employee_id', e.employee_id,
    'auth_user_id', e.auth_user_id,
    'name', e.name,
    'email', e.email,
    'phone', e.phone,
    'role', e.role::TEXT,
    'status', e.status::TEXT,
    'avatar_url', e.avatar_url,
    'address', e.address,
    'emergency_contact', e.emergency_contact,
    'emergency_contact_name', e.emergency_contact_name,
    'date_of_birth', e.date_of_birth,
    'blood_group', e.blood_group,
    'hired_date', e.hired_date,
    'portal_enabled', e.portal_enabled,
    'permissions', e.permissions,
    'notes', e.notes,
    'last_login', e.last_login,
    'created_at', e.created_at,
    'updated_at', e.updated_at,
    'created_by', e.created_by,
    'is_2fa_enabled', e.is_2fa_enabled,
    'license_id', e.license_id,
    'salary', e.salary,
    'total_tips', e.total_tips,
    'total_orders_taken', e.total_orders_taken,
    'bank_details', e.bank_details,
    'documents', e.documents,
    -- License info (from employee_licenses table)
    'license', (
      SELECT jsonb_build_object(
        'id', el.id,
        'license_id', el.license_id,
        'is_used', el.is_used,
        'activated_at', el.activated_at,
        'expires_at', el.expires_at,
        'issued_at', el.issued_at,
        'is_active', CASE 
          WHEN el.expires_at IS NULL THEN true
          WHEN el.expires_at > NOW() THEN true
          ELSE false
        END
      )
      FROM employee_licenses el
      WHERE el.employee_id = e.id
      ORDER BY el.issued_at DESC
      LIMIT 1
    ),
    -- Payroll info
    'payroll', jsonb_build_object(
      'salary', e.salary,
      'bank_details', e.bank_details,
      'total_tips', e.total_tips,
      'total_orders_taken', e.total_orders_taken,
      'latest_payroll', (
        SELECT jsonb_build_object(
          'id', ep.id,
          'month', ep.month,
          'year', ep.year,
          'base_salary', ep.base_salary,
          'bonus', ep.bonus,
          'deductions', ep.deductions,
          'tips', ep.tips,
          'total_amount', ep.total_amount,
          'paid', ep.paid,
          'paid_at', ep.paid_at,
          'paid_by', ep.paid_by,
          'notes', ep.notes
        )
        FROM employee_payroll ep
        WHERE ep.employee_id = e.id
        ORDER BY ep.year DESC, ep.month DESC
        LIMIT 1
      ),
      'pending_amount', COALESCE((
        SELECT SUM(ep.total_amount)
        FROM employee_payroll ep
        WHERE ep.employee_id = e.id AND ep.paid = false
      ), 0),
      'total_paid', COALESCE((
        SELECT SUM(ep.total_amount)
        FROM employee_payroll ep
        WHERE ep.employee_id = e.id AND ep.paid = true
      ), 0)
    ),
    -- Documents array (from employee_documents table)
    'employee_documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ed.id,
        'document_type', ed.document_type,
        'document_name', ed.document_name,
        'file_url', ed.file_url,
        'file_type', ed.file_type,
        'uploaded_at', ed.uploaded_at,
        'verified', ed.verified,
        'verified_at', ed.verified_at,
        'verified_by', ed.verified_by
      ) ORDER BY ed.uploaded_at DESC)
      FROM employee_documents ed
      WHERE ed.employee_id = e.id
    ), '[]'::JSONB),
    -- Attendance stats
    'attendance_stats', jsonb_build_object(
      'this_month', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id 
        AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE)
      ), 0),
      'last_month', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id 
        AND DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      ), 0),
      'total', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id
      ), 0),
      'late_count', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id AND a.status = 'late'
      ), 0),
      'last_check_in', (
        SELECT a.check_in FROM attendance a
        WHERE a.employee_id = e.id
        ORDER BY a.date DESC
        LIMIT 1
      )
    ),
    -- Recent attendance records
    'recent_attendance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'date', a.date,
        'check_in', a.check_in,
        'check_out', a.check_out,
        'status', a.status,
        'notes', a.notes
      ) ORDER BY a.date DESC)
      FROM (
        SELECT * FROM attendance 
        WHERE employee_id = e.id 
        ORDER BY date DESC 
        LIMIT 10
      ) a
    ), '[]'::JSONB)
  ) INTO v_result
  FROM employees e
  WHERE e.id = p_employee_id;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'Employee not found', 'success', false);
  END IF;

  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;


--
-- Name: get_employee_dashboard_stats(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_dashboard_stats(p_employee_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result JSON;
  v_employee RECORD;
  v_start DATE := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  v_end DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
  SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Employee not found');
  END IF;
  
  SELECT json_build_object(
    'days_working', COALESCE(
      EXTRACT(DAY FROM (CURRENT_DATE - v_employee.hired_date::date)), 0
    ),
    'attendance_count', COALESCE((
      SELECT COUNT(*)
      FROM attendance
      WHERE employee_id = p_employee_id
        AND DATE(check_in) >= v_start
        AND DATE(check_in) <= v_end
    ), 0),
    'attendance_this_month', COALESCE((
      SELECT COUNT(*)
      FROM attendance
      WHERE employee_id = p_employee_id
        AND DATE(check_in) >= DATE_TRUNC('month', CURRENT_DATE)
        AND DATE(check_in) <= CURRENT_DATE
    ), 0),
    'total_days_in_range', (v_end - v_start + 1),
    'on_time_percentage', COALESCE((
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE is_late = false)::numeric / NULLIF(COUNT(*), 0)) * 100
      )
      FROM attendance
      WHERE employee_id = p_employee_id
        AND DATE(check_in) >= v_start
        AND DATE(check_in) <= v_end
    ), 100),
    'status', v_employee.status,
    'role', v_employee.role,
    'date_range', json_build_object(
        'start_date', v_start,
        'end_date', v_end
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;


--
-- Name: get_employee_for_2fa(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_for_2fa(p_employee_id uuid) RETURNS TABLE(id uuid, email text, name text, phone text, role text, permissions jsonb, auth_user_id uuid, two_fa_secret text, is_2fa_enabled boolean, status text, portal_enabled boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.email::TEXT,
        e.name::TEXT,
        e.phone::TEXT,
        e.role::TEXT,
        e.permissions,
        e.auth_user_id,
        e.two_fa_secret::TEXT,
        e.is_2fa_enabled,
        e.status::TEXT,
        COALESCE(e.portal_enabled, true) AS portal_enabled
    FROM employees e
    WHERE e.id = p_employee_id;
END;
$$;


--
-- Name: get_employee_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_id() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
BEGIN
    SELECT id INTO emp_id
    FROM employees
    WHERE auth_user_id = auth.uid()
    AND status = 'active';
    
    RETURN emp_id;
END;
$$;


--
-- Name: get_employee_leave_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_leave_details(p_employee_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  balance_record RECORD;
  emp_record RECORD;
  result JSON;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  -- Get employee info
  SELECT * INTO emp_record FROM employees WHERE id = p_employee_id;
  IF emp_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Employee not found');
  END IF;
  
  -- Get or create balance
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = p_employee_id;
  IF balance_record IS NULL THEN
    INSERT INTO leave_balances (employee_id) VALUES (p_employee_id)
    RETURNING * INTO balance_record;
  END IF;
  
  -- Build complete response
  SELECT json_build_object(
    'success', true,
    'employee', json_build_object(
      'id', emp_record.id,
      'employee_id', emp_record.employee_id,
      'name', emp_record.name,
      'role', emp_record.role,
      'avatar_url', emp_record.avatar_url
    ),
    'balance', json_build_object(
      'annual', json_build_object('total', balance_record.annual_leave, 'used', balance_record.annual_used, 'available', balance_record.annual_leave - balance_record.annual_used),
      'sick', json_build_object('total', balance_record.sick_leave, 'used', balance_record.sick_used, 'available', balance_record.sick_leave - balance_record.sick_used),
      'casual', json_build_object('total', balance_record.casual_leave, 'used', balance_record.casual_used, 'available', balance_record.casual_leave - balance_record.casual_used)
    ),
    'requests', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', id,
          'leave_type', leave_type,
          'start_date', start_date,
          'end_date', end_date,
          'total_days', total_days,
          'status', status,
          'created_at', created_at
        ) ORDER BY created_at DESC
      )
      FROM leave_requests
      WHERE employee_id = p_employee_id
      AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    ), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;


--
-- Name: get_employee_leave_details(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_leave_details(p_caller_id uuid, p_employee_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  balance_record RECORD;
  emp_record RECORD;
  result JSON;
BEGIN
  IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  
  SELECT * INTO emp_record FROM employees WHERE id = p_employee_id;
  IF emp_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Employee not found'); END IF;
  
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = p_employee_id;
  IF balance_record IS NULL THEN
    INSERT INTO leave_balances (employee_id) VALUES (p_employee_id) RETURNING * INTO balance_record;
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'employee', json_build_object('id', emp_record.id, 'employee_id', emp_record.employee_id, 'name', emp_record.name, 'role', emp_record.role, 'avatar_url', emp_record.avatar_url),
    'balance', json_build_object(
      'annual', json_build_object('total', balance_record.annual_leave, 'used', balance_record.annual_used, 'available', balance_record.annual_leave - balance_record.annual_used),
      'sick', json_build_object('total', balance_record.sick_leave, 'used', balance_record.sick_used, 'available', balance_record.sick_leave - balance_record.sick_used),
      'casual', json_build_object('total', balance_record.casual_leave, 'used', balance_record.casual_used, 'available', balance_record.casual_leave - balance_record.casual_used)
    ),
    'requests', COALESCE((SELECT json_agg(json_build_object('id', id, 'leave_type', leave_type, 'start_date', start_date, 'end_date', end_date, 'total_days', total_days, 'status', status, 'created_at', created_at) ORDER BY created_at DESC) FROM leave_requests WHERE employee_id = p_employee_id AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;


--
-- Name: get_employee_payroll_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_payroll_summary(p_employee_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'employee', (
      SELECT jsonb_build_object(
        'id', id,
        'employee_id', employee_id,
        'name', name,
        'email', email,
        'phone', phone,
        'role', role::TEXT,
        'status', status::TEXT,
        'avatar_url', avatar_url,
        'salary', salary,
        'bank_details', bank_details,
        'total_tips', total_tips,
        'total_orders_taken', total_orders_taken,
        'hired_date', hired_date,
        'address', address
      )
      FROM employees WHERE id = p_employee_id
    ),
    'payroll_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'month', month,
        'year', year,
        'base_salary', base_salary,
        'bonus', bonus,
        'deductions', deductions,
        'tips', tips,
        'total_amount', total_amount,
        'paid', paid,
        'paid_at', paid_at,
        'paid_by', paid_by,
        'notes', notes,
        'created_at', created_at
      ) ORDER BY year DESC, month DESC)
      FROM employee_payroll WHERE employee_id = p_employee_id
    ), '[]'::JSONB),
    'totals', (
      SELECT jsonb_build_object(
        'total_paid', COALESCE(SUM(CASE WHEN paid THEN total_amount ELSE 0 END), 0),
        'total_pending', COALESCE(SUM(CASE WHEN NOT paid THEN total_amount ELSE 0 END), 0),
        'total_tips', COALESCE(SUM(tips), 0),
        'total_bonus', COALESCE(SUM(bonus), 0),
        'total_deductions', COALESCE(SUM(deductions), 0),
        'months_paid', COUNT(*) FILTER (WHERE paid = true),
        'months_pending', COUNT(*) FILTER (WHERE paid = false)
      )
      FROM employee_payroll WHERE employee_id = p_employee_id
    ),
    'current_year_summary', (
      SELECT jsonb_build_object(
        'year', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
        'total_earned', COALESCE(SUM(total_amount), 0),
        'total_paid', COALESCE(SUM(CASE WHEN paid THEN total_amount ELSE 0 END), 0),
        'total_pending', COALESCE(SUM(CASE WHEN NOT paid THEN total_amount ELSE 0 END), 0),
        'months_worked', COUNT(*)
      )
      FROM employee_payroll 
      WHERE employee_id = p_employee_id 
      AND year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    ),
    'attendance_summary', (
      SELECT jsonb_build_object(
        'this_month_days', COALESCE(COUNT(*), 0),
        'late_days_this_month', COALESCE(COUNT(*) FILTER (WHERE status = 'late'), 0)
      )
      FROM attendance
      WHERE employee_id = p_employee_id
      AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
    )
  );
END;
$$;


--
-- Name: get_employee_performance_report(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_performance_report(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- Check authorization - allow server-side calls (auth.uid() is null)
    IF auth.uid() IS NULL THEN
        v_is_authorized := TRUE;
    ELSE
        v_is_authorized := EXISTS (
            SELECT 1 FROM employees 
            WHERE auth_user_id = auth.uid() 
            AND status = 'active'
            AND role IN ('admin', 'manager')
        );
    END IF;
    
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'employee_id', e.id,
            'employee_name', e.name,
            'role', e.role,
            'orders_handled', COALESCE(perf.orders_handled, 0),
            'total_sales', COALESCE(perf.total_sales, 0),
            'attendance_rate', COALESCE(att.attendance_rate, 0),
            'total_days', COALESCE(att.total_days, 0),
            'present_days', COALESCE(att.present_days, 0)
        )
        ORDER BY perf.orders_handled DESC NULLS LAST
    ) INTO result
    FROM employees e
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) as orders_handled,
            SUM(total) as total_sales
        FROM orders o
        WHERE o.assigned_to = e.id
        AND o.status NOT IN ('cancelled')
        AND (p_start_date IS NULL OR DATE(o.created_at) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(o.created_at) <= p_end_date)
    ) perf ON true
    LEFT JOIN LATERAL (
        SELECT 
            COUNT(*) as total_days,
            COUNT(*) FILTER (WHERE status IN ('present', 'late')) as present_days,
            ROUND(
                COUNT(*) FILTER (WHERE status IN ('present', 'late'))::numeric / 
                NULLIF(COUNT(*)::numeric, 0) * 100, 1
            ) as attendance_rate
        FROM attendance a
        WHERE a.employee_id = e.id
        AND (p_start_date IS NULL OR a.date >= p_start_date)
        AND (p_end_date IS NULL OR a.date <= p_end_date)
    ) att ON true
    WHERE e.status = 'active';
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_employee_profile_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_profile_by_id(p_employee_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Fetch employee profile by ID
  SELECT json_build_object(
    'success', true,
    'employee', json_build_object(
      'id', e.id,
      'auth_user_id', e.auth_user_id,
      'employee_id', e.employee_id,
      'name', e.name,
      'email', e.email,
      'phone', COALESCE(e.phone, ''),
      'address', COALESCE(e.address, ''),
      'emergency_contact', COALESCE(e.emergency_contact, ''),
      'avatar_url', COALESCE(e.avatar_url, ''),
      'role', e.role,
      'hired_date', e.hired_date,
      'is_2fa_enabled', COALESCE(e.is_2fa_enabled, false),
      'status', e.status,
      'portal_enabled', e.portal_enabled
    )
  ) INTO v_result
  FROM employees e
  WHERE e.id = p_employee_id;
  
  IF v_result IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Employee not found');
  END IF;
  
  RETURN v_result;
END;
$$;


--
-- Name: get_employee_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_role() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
    emp_role TEXT;
BEGIN
    SELECT role::TEXT INTO emp_role
    FROM employees
    WHERE auth_user_id = auth.uid()
    AND status = 'active';
    RETURN emp_role;
END;
$$;


--
-- Name: get_employees_dashboard_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employees_dashboard_stats() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN jsonb_build_object(
    'total', (SELECT COUNT(*) FROM employees),
    'active', (SELECT COUNT(*) FROM employees WHERE status = 'active'),
    'inactive', (SELECT COUNT(*) FROM employees WHERE status = 'inactive'),
    'pending', (SELECT COUNT(*) FROM employees WHERE status = 'pending'),
    'blocked', (SELECT COUNT(*) FROM employees WHERE status = 'blocked'),
    'portal_enabled', (SELECT COUNT(*) FROM employees WHERE portal_enabled = true),
    'by_role', (
      SELECT jsonb_object_agg(role::TEXT, cnt)
      FROM (
        SELECT role, COUNT(*) as cnt
        FROM employees
        GROUP BY role
      ) r
    ),
    'hired_this_month', (
      SELECT COUNT(*) FROM employees 
      WHERE DATE_TRUNC('month', hired_date) = DATE_TRUNC('month', CURRENT_DATE)
    ),
    'present_today', (
      SELECT COUNT(DISTINCT employee_id) FROM attendance 
      WHERE date = CURRENT_DATE AND status = 'present'
    )
  );
END;
$$;


--
-- Name: get_employees_paginated(integer, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employees_paginated(p_page integer DEFAULT 1, p_limit integer DEFAULT 20, p_search text DEFAULT NULL::text, p_role text DEFAULT NULL::text, p_status text DEFAULT NULL::text) RETURNS TABLE(employees jsonb, total_count integer, page integer, total_pages integer, has_next boolean, has_prev boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_offset INTEGER;
  v_total INTEGER;
  v_employees JSONB;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  -- Get total count first (for pagination)
  SELECT COUNT(*)::INTEGER INTO v_total
  FROM employees e
  WHERE 
    (p_search IS NULL OR p_search = '' OR 
      e.name ILIKE '%' || p_search || '%' OR
      e.email ILIKE '%' || p_search || '%' OR
      e.employee_id ILIKE '%' || p_search || '%' OR
      e.phone ILIKE '%' || p_search || '%')
    AND (p_role IS NULL OR p_role = '' OR p_role = 'all' OR e.role::TEXT = p_role)
    AND (p_status IS NULL OR p_status = '' OR p_status = 'all' OR e.status::TEXT = p_status);

  -- Get employees with all data in single query
  SELECT COALESCE(jsonb_agg(emp ORDER BY emp->>'created_at' DESC), '[]'::JSONB) INTO v_employees
  FROM (
    SELECT jsonb_build_object(
      'id', e.id,
      'employee_id', e.employee_id,
      'license_id', el.license_id,
      'name', e.name,
      'email', e.email,
      'phone', e.phone,
      'role', e.role::TEXT,
      'status', e.status::TEXT,
      'avatar_url', e.avatar_url,
      'portal_enabled', e.portal_enabled,
      'hired_date', e.hired_date,
      'salary', e.salary,
      'total_tips', e.total_tips,
      'total_orders_taken', e.total_orders_taken,
      'last_login', e.last_login,
      'created_at', e.created_at,
      'attendance_this_month', COALESCE((
        SELECT COUNT(*)::INTEGER FROM attendance a 
        WHERE a.employee_id = e.id 
        AND DATE_TRUNC('month', a.check_in) = DATE_TRUNC('month', CURRENT_DATE)
      ), 0),
      'documents_count', COALESCE((
        SELECT COUNT(*)::INTEGER FROM employee_documents ed 
        WHERE ed.employee_id = e.id
      ), 0)
    ) as emp
    FROM employees e
    LEFT JOIN employee_licenses el ON el.employee_id = e.id
    WHERE 
      (p_search IS NULL OR p_search = '' OR 
        e.name ILIKE '%' || p_search || '%' OR
        e.email ILIKE '%' || p_search || '%' OR
        e.employee_id ILIKE '%' || p_search || '%' OR
        e.phone ILIKE '%' || p_search || '%')
      AND (p_role IS NULL OR p_role = '' OR p_role = 'all' OR e.role::TEXT = p_role)
      AND (p_status IS NULL OR p_status = '' OR p_status = 'all' OR e.status::TEXT = p_status)
    ORDER BY e.created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) sub;

  RETURN QUERY SELECT 
    v_employees,
    v_total,
    p_page,
    CEIL(v_total::NUMERIC / p_limit)::INTEGER,
    (p_page * p_limit) < v_total,
    p_page > 1;
END;
$$;


--
-- Name: get_employees_payroll_list(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employees_payroll_list() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(emp ORDER BY emp.name), '[]'::json) INTO result
    FROM (
        SELECT 
            e.id,
            e.name,
            e.email,
            e.phone,
            e.role,
            e.status,
            e.employee_id,
            e.salary,
            e.hired_date,
            e.avatar_url,
            e.bank_details,
            e.address,
            e.date_of_birth,
            e.blood_group,
            e.emergency_contact,
            e.emergency_contact_name,
            e.created_at,
            (SELECT json_build_object(
                'id', ep.id,
                'base_salary', ep.base_salary,
                'payment_frequency', ep.payment_frequency,
                'bank_details', ep.bank_details,
                'month', ep.month,
                'year', ep.year,
                'bonus', ep.bonus,
                'deductions', ep.deductions,
                'tips', ep.tips,
                'total_amount', ep.total_amount,
                'paid', ep.paid
            ) FROM employee_payroll ep 
            WHERE ep.employee_id = e.id 
            ORDER BY ep.year DESC, ep.month DESC LIMIT 1
            ) as latest_payroll,
            (SELECT COUNT(*) FROM payslips p WHERE p.employee_id = e.id) as total_payslips,
            (SELECT COUNT(*) FROM payslips p WHERE p.employee_id = e.id AND p.status = 'pending') as pending_payslips,
            (SELECT COALESCE(SUM(p.net_salary), 0) FROM payslips p WHERE p.employee_id = e.id AND p.status = 'paid') as total_paid_amount
        FROM employees e
        WHERE e.status = 'active'
    ) emp;
    
    RETURN result;
END;
$$;


--
-- Name: get_expiring_items(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_expiring_items(p_days integer DEFAULT 30) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', id,
            'name', name,
            'sku', sku,
            'category', category,
            'current_stock', quantity,
            'unit', unit,
            'expiry_date', expiry_date,
            'days_until_expiry', expiry_date - CURRENT_DATE,
            'value_at_risk', quantity * cost_per_unit,
            'status', CASE 
                WHEN expiry_date < CURRENT_DATE THEN 'expired'
                WHEN expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
                ELSE 'warning'
            END
        )
        ORDER BY expiry_date ASC
    ) INTO result
    FROM inventory
    WHERE expiry_date IS NOT NULL
    AND expiry_date <= CURRENT_DATE + (p_days || ' days')::INTERVAL
    AND COALESCE(is_active, true) = true
    AND quantity > 0;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_favorite_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_favorite_ids(p_customer_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: get_hourly_sales(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_hourly_sales(p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    v_is_single_day BOOLEAN := (p_start_date = p_end_date);
BEGIN
    IF v_is_single_day THEN
        -- Single day: show hourly breakdown
        WITH hourly_data AS (
            SELECT 
                EXTRACT(HOUR FROM created_at)::int AS hour,
                COALESCE(SUM(total), 0) AS sales,
                COUNT(*) AS orders
            FROM orders
            WHERE DATE(created_at) = p_start_date
              AND status NOT IN ('cancelled')
            GROUP BY EXTRACT(HOUR FROM created_at)
        ),
        all_hours AS (
            SELECT generate_series(0, 23) AS hour
        ),
        combined AS (
            SELECT 
                ah.hour,
                COALESCE(hd.sales, 0) AS sales,
                COALESCE(hd.orders, 0) AS orders
            FROM all_hours ah
            LEFT JOIN hourly_data hd ON ah.hour = hd.hour
            ORDER BY ah.hour
        )
        SELECT json_build_object(
            'type', 'hourly',
            'data', (SELECT json_agg(json_build_object('hour', hour, 'sales', sales, 'orders', orders)) FROM combined),
            'summary', json_build_object(
                'total_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = p_start_date AND status NOT IN ('cancelled')),
                'total_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = p_start_date),
                'avg_order_value', (SELECT COALESCE(AVG(total), 0) FROM orders WHERE DATE(created_at) = p_start_date AND status NOT IN ('cancelled')),
                'peak_hour', (SELECT hour FROM combined ORDER BY sales DESC LIMIT 1)
            ),
            'comparison', json_build_object(
                'previous_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = p_start_date - 1 AND status NOT IN ('cancelled')),
                'previous_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) = p_start_date - 1)
            )
        ) INTO result;
    ELSE
        -- Multiple days: show daily breakdown
        WITH daily_data AS (
            SELECT 
                DATE(created_at) AS date,
                COALESCE(SUM(total), 0) AS sales,
                COUNT(*) AS orders
            FROM orders
            WHERE DATE(created_at) >= p_start_date
              AND DATE(created_at) <= p_end_date
              AND status NOT IN ('cancelled')
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        ),
        all_days AS (
            SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS date
        ),
        combined AS (
            SELECT 
                ad.date,
                COALESCE(dd.sales, 0) AS sales,
                COALESCE(dd.orders, 0) AS orders
            FROM all_days ad
            LEFT JOIN daily_data dd ON ad.date = dd.date
            ORDER BY ad.date
        )
        SELECT json_build_object(
            'type', 'daily',
            'data', (SELECT json_agg(json_build_object('date', date, 'sales', sales, 'orders', orders)) FROM combined),
            'summary', json_build_object(
                'total_sales', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status NOT IN ('cancelled')),
                'total_orders', (SELECT COUNT(*) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date),
                'avg_order_value', (SELECT COALESCE(AVG(total), 0) FROM orders WHERE DATE(created_at) >= p_start_date AND DATE(created_at) <= p_end_date AND status NOT IN ('cancelled')),
                'best_day', (SELECT date FROM combined ORDER BY sales DESC LIMIT 1)
            ),
            'comparison', json_build_object(
                'previous_period_sales', (
                    SELECT COALESCE(SUM(total), 0) FROM orders 
                    WHERE DATE(created_at) >= p_start_date - (p_end_date - p_start_date + 1)
                      AND DATE(created_at) < p_start_date
                      AND status NOT IN ('cancelled')
                ),
                'previous_period_orders', (
                    SELECT COUNT(*) FROM orders 
                    WHERE DATE(created_at) >= p_start_date - (p_end_date - p_start_date + 1)
                      AND DATE(created_at) < p_start_date
                )
            )
        ) INTO result;
    END IF;
    
    RETURN result;
END;
$$;


--
-- Name: get_hourly_sales_today(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_hourly_sales_today() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN get_hourly_sales(CURRENT_DATE, CURRENT_DATE);
END;
$$;


--
-- Name: get_inventory_alerts(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_inventory_alerts(p_unread_only boolean DEFAULT true) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', a.id,
            'item_id', a.inventory_id,
            'item_name', i.name,
            'alert_type', a.alert_type,
            'message', a.message,
            'is_read', a.is_read,
            'is_resolved', a.is_resolved,
            'created_at', a.created_at
        )
        ORDER BY a.created_at DESC
    ) INTO result
    FROM inventory_alerts a
    JOIN inventory i ON i.id = a.inventory_id
    WHERE (NOT p_unread_only OR (a.is_read = false AND a.is_resolved = false));
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_inventory_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_inventory_items() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', i.id,
            'name', i.name,
            'sku', COALESCE(i.sku, ''),
            'category', i.category,
            'unit', i.unit,
            'current_stock', COALESCE(i.quantity, 0),
            'min_stock', COALESCE(i.min_quantity, 0),
            'max_stock', COALESCE(i.max_quantity, 100),
            'cost_per_unit', COALESCE(i.cost_per_unit, 0),
            'supplier', COALESCE(i.supplier, ''),
            'last_restocked', i.last_restocked,
            'status', CASE 
                WHEN COALESCE(i.quantity, 0) <= 0 THEN 'out_of_stock'
                WHEN COALESCE(i.quantity, 0) <= COALESCE(i.min_quantity, 0) THEN 'low_stock'
                ELSE 'in_stock'
            END,
            'notes', i.notes,
            'location', i.location,
            'barcode', i.barcode,
            'expiry_date', i.expiry_date,
            'is_active', COALESCE(i.is_active, true),
            'reorder_point', COALESCE(i.reorder_point, i.min_quantity, 10),
            'lead_time_days', COALESCE(i.lead_time_days, 7),
            'total_value', ROUND(COALESCE(i.quantity, 0) * COALESCE(i.cost_per_unit, 0), 2),
            'created_at', i.created_at,
            'updated_at', i.updated_at
        )
        ORDER BY i.name
    ) INTO result
    FROM inventory i
    WHERE COALESCE(i.is_active, true) = true;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_inventory_movement_report(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_inventory_movement_report(p_start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), p_end_date date DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'period', json_build_object('start', p_start_date, 'end', p_end_date),
        'summary', json_build_object(
            'total_purchases', COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN ABS(quantity_change) ELSE 0 END), 0),
            'total_usage', COALESCE(SUM(CASE WHEN transaction_type = 'usage' THEN ABS(quantity_change) ELSE 0 END), 0),
            'total_waste', COALESCE(SUM(CASE WHEN transaction_type = 'waste' THEN ABS(quantity_change) ELSE 0 END), 0),
            'total_adjustments', COALESCE(SUM(CASE WHEN transaction_type IN ('adjustment', 'count') THEN ABS(quantity_change) ELSE 0 END), 0),
            'purchase_value', COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN total_cost ELSE 0 END), 0),
            'usage_value', COALESCE(SUM(CASE WHEN transaction_type = 'usage' THEN total_cost ELSE 0 END), 0),
            'waste_value', COALESCE(SUM(CASE WHEN transaction_type = 'waste' THEN total_cost ELSE 0 END), 0)
        ),
        'by_category', (
            SELECT json_agg(json_build_object(
                'category', i.category,
                'purchases', COALESCE(SUM(CASE WHEN t.transaction_type = 'purchase' THEN ABS(t.quantity_change) ELSE 0 END), 0),
                'usage', COALESCE(SUM(CASE WHEN t.transaction_type = 'usage' THEN ABS(t.quantity_change) ELSE 0 END), 0),
                'waste', COALESCE(SUM(CASE WHEN t.transaction_type = 'waste' THEN ABS(t.quantity_change) ELSE 0 END), 0)
            ))
            FROM inventory_transactions t
            JOIN inventory i ON i.id = t.inventory_id
            WHERE DATE(t.created_at) BETWEEN p_start_date AND p_end_date
            GROUP BY i.category
        ),
        'daily_movement', (
            SELECT json_agg(json_build_object(
                'date', day,
                'purchases', COALESCE(purchases, 0),
                'usage', COALESCE(usage, 0),
                'waste', COALESCE(waste, 0)
            ) ORDER BY day)
            FROM (
                SELECT 
                    DATE(created_at) as day,
                    SUM(CASE WHEN transaction_type = 'purchase' THEN ABS(quantity_change) ELSE 0 END) as purchases,
                    SUM(CASE WHEN transaction_type = 'usage' THEN ABS(quantity_change) ELSE 0 END) as usage,
                    SUM(CASE WHEN transaction_type = 'waste' THEN ABS(quantity_change) ELSE 0 END) as waste
                FROM inventory_transactions
                WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
                GROUP BY DATE(created_at)
            ) daily
        )
    ) INTO result
    FROM inventory_transactions
    WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date;
    
    RETURN result;
END;
$$;


--
-- Name: get_inventory_report(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_inventory_report() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- Check if user is authenticated and is manager/admin
    -- OR if called from server-side (auth.uid() is null - server queries don't have session)
    IF auth.uid() IS NULL THEN
        -- Server-side call - authorization is handled at app level
        v_is_authorized := TRUE;
    ELSE
        -- Client-side call - check if user is manager or admin
        v_is_authorized := EXISTS (
            SELECT 1 FROM employees 
            WHERE auth_user_id = auth.uid() 
            AND status = 'active'
            AND role IN ('admin', 'manager')
        );
    END IF;
    
    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_build_object(
        'total_items', (SELECT COUNT(*) FROM inventory),
        'low_stock_count', (SELECT COUNT(*) FROM inventory WHERE quantity <= min_quantity),
        'out_of_stock', (SELECT COUNT(*) FROM inventory WHERE quantity = 0),
        'total_value', (SELECT COALESCE(SUM(quantity * cost_per_unit), 0) FROM inventory),
        'categories', (
            SELECT COALESCE(json_agg(cat_data), '[]'::json)
            FROM (
                SELECT 
                    json_build_object(
                        'category', category,
                        'item_count', COUNT(*),
                        'total_value', SUM(quantity * cost_per_unit),
                        'low_stock', COUNT(*) FILTER (WHERE quantity <= min_quantity)
                    ) as cat_data
                FROM inventory
                GROUP BY category
            ) cat_sub
        ),
        'low_stock_items', (
            SELECT COALESCE(json_agg(item_data), '[]'::json)
            FROM (
                SELECT 
                    json_build_object(
                        'id', id,
                        'name', name,
                        'quantity', quantity,
                        'min_quantity', min_quantity,
                        'unit', unit
                    ) as item_data
                FROM inventory
                WHERE quantity <= min_quantity
                ORDER BY (quantity / NULLIF(min_quantity, 0)) ASC
                LIMIT 10
            ) item_sub
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_inventory_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_inventory_summary() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_items', COUNT(*),
        'total_value', COALESCE(SUM(COALESCE(quantity, 0) * COALESCE(cost_per_unit, 0)), 0),
        'low_stock_count', COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= COALESCE(min_quantity, 0)),
        'out_of_stock_count', COUNT(*) FILTER (WHERE quantity <= 0),
        'in_stock_count', COUNT(*) FILTER (WHERE quantity > COALESCE(min_quantity, 0)),
        'overstock_count', COUNT(*) FILTER (WHERE quantity > COALESCE(max_quantity, 100)),
        'categories', (
            SELECT json_agg(json_build_object(
                'category', category,
                'count', cnt,
                'value', val
            ))
            FROM (
                SELECT 
                    category, 
                    COUNT(*) as cnt,
                    COALESCE(SUM(quantity * cost_per_unit), 0) as val
                FROM inventory 
                WHERE COALESCE(is_active, true) = true
                GROUP BY category
            ) cats
        ),
        'expiring_soon', COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '7 days'),
        'expired', COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE)
    ) INTO result
    FROM inventory
    WHERE COALESCE(is_active, true) = true;
    
    RETURN result;
END;
$$;


--
-- Name: get_inventory_suppliers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_inventory_suppliers() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', s.id,
            'name', s.name,
            'contact_person', s.contact_person,
            'email', s.email,
            'phone', s.phone,
            'address', s.address,
            'city', s.city,
            'payment_terms', s.payment_terms,
            'lead_time_days', s.lead_time_days,
            'rating', s.rating,
            'is_active', s.is_active,
            'items_count', (SELECT COUNT(*) FROM inventory WHERE supplier = s.name),
            'notes', s.notes,
            'created_at', s.created_at
        )
        ORDER BY s.name
    ) INTO result
    FROM inventory_suppliers s;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_inventory_transactions(uuid, date, date, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_inventory_transactions(p_item_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 100, p_transaction_type text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', t.id,
            'item_id', t.inventory_id,
            'item_name', i.name,
            'item_sku', i.sku,
            'type', COALESCE(t.transaction_type, t.type),
            'quantity', COALESCE(t.quantity_change, t.quantity),
            'unit', i.unit,
            'unit_cost', t.unit_cost,
            'total_cost', t.total_cost,
            'reason', COALESCE(t.notes, t.reason),
            'reference_number', t.reference_number,
            'batch_number', t.batch_number,
            'performed_by', (SELECT name FROM employees WHERE id = COALESCE(t.created_by, t.performed_by)),
            'created_at', t.created_at
        )
        ORDER BY t.created_at DESC
    ) INTO result
    FROM inventory_transactions t
    JOIN inventory i ON i.id = t.inventory_id
    WHERE (p_item_id IS NULL OR t.inventory_id = p_item_id)
    AND (p_start_date IS NULL OR DATE(t.created_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(t.created_at) <= p_end_date)
    AND (p_transaction_type IS NULL OR COALESCE(t.transaction_type, t.type) = p_transaction_type)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_inventory_value_by_category(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_inventory_value_by_category() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'category', category,
            'items_count', COUNT(*),
            'total_quantity', SUM(COALESCE(quantity, 0)),
            'total_value', SUM(COALESCE(quantity, 0) * COALESCE(cost_per_unit, 0)),
            'low_stock_items', COUNT(*) FILTER (WHERE quantity <= COALESCE(min_quantity, 0) AND quantity > 0),
            'out_of_stock_items', COUNT(*) FILTER (WHERE quantity <= 0)
        )
    ) INTO result
    FROM inventory
    WHERE COALESCE(is_active, true) = true
    GROUP BY category
    ORDER BY SUM(COALESCE(quantity, 0) * COALESCE(cost_per_unit, 0)) DESC;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_invoice_details(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invoice_details(p_invoice_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_invoice RECORD;
    v_order RECORD;
    v_waiter_id UUID := NULL;
    v_waiter_name TEXT := NULL;
    v_waiter_employee_id TEXT := NULL;
    v_biller_id UUID := NULL;
    v_biller_name TEXT := NULL;
    v_biller_employee_id TEXT := NULL;
    v_order_id UUID := NULL;
    v_order_number TEXT := NULL;
    v_order_created_at TIMESTAMPTZ := NULL;
BEGIN
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    
    IF v_invoice IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invoice not found');
    END IF;
    
    -- Get order details
    IF v_invoice.order_id IS NOT NULL THEN
        SELECT * INTO v_order FROM orders WHERE id = v_invoice.order_id;
        v_order_id := v_order.id;
        v_order_number := v_order.order_number;
        v_order_created_at := v_order.created_at;
    END IF;
    
    -- Get waiter details
    IF v_invoice.served_by IS NOT NULL THEN
        SELECT id, name, employee_id INTO v_waiter_id, v_waiter_name, v_waiter_employee_id 
        FROM employees WHERE id = v_invoice.served_by;
    END IF;
    
    -- Get biller details
    IF v_invoice.billed_by IS NOT NULL THEN
        SELECT id, name, employee_id INTO v_biller_id, v_biller_name, v_biller_employee_id 
        FROM employees WHERE id = v_invoice.billed_by;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'invoice', json_build_object(
            'id', v_invoice.id,
            'invoice_number', v_invoice.invoice_number,
            'order_type', v_invoice.order_type,
            'customer_name', v_invoice.customer_name,
            'customer_phone', v_invoice.customer_phone,
            'customer_email', v_invoice.customer_email,
            'items', v_invoice.items,
            'subtotal', v_invoice.subtotal,
            'discount', v_invoice.discount,
            'discount_details', v_invoice.discount_details,
            'tax', v_invoice.tax,
            'service_charge', v_invoice.service_charge,
            'delivery_fee', v_invoice.delivery_fee,
            'tip', v_invoice.tip,
            'total', v_invoice.total,
            'payment_method', v_invoice.payment_method,
            'payment_status', v_invoice.payment_status,
            'table_number', v_invoice.table_number,
            'loyalty_points_earned', v_invoice.loyalty_points_earned,
            'printed', v_invoice.printed,
            'printed_at', v_invoice.printed_at,
            'notes', v_invoice.notes,
            'created_at', v_invoice.created_at
        ),
        'brand', v_invoice.brand_info,
        'waiter', CASE WHEN v_waiter_id IS NOT NULL THEN json_build_object(
            'id', v_waiter_id,
            'name', v_waiter_name,
            'employee_id', v_waiter_employee_id
        ) ELSE NULL END,
        'billed_by', CASE WHEN v_biller_id IS NOT NULL THEN json_build_object(
            'id', v_biller_id,
            'name', v_biller_name,
            'employee_id', v_biller_employee_id
        ) ELSE NULL END,
        'order', CASE WHEN v_order_id IS NOT NULL THEN json_build_object(
            'id', v_order_id,
            'order_number', v_order_number,
            'order_type', v_order.order_type,
            'table_number', v_order.table_number,
            'created_at', v_order_created_at,
            'transaction_id', v_order.transaction_id,
            'online_payment_method_id', v_order.online_payment_method_id,
            'online_payment_details', v_order.online_payment_details
        ) ELSE NULL END,
        'transaction_id', CASE WHEN v_order.transaction_id IS NOT NULL THEN v_order.transaction_id ELSE NULL END,
        'online_payment_details', CASE WHEN v_order.online_payment_details IS NOT NULL THEN v_order.online_payment_details ELSE NULL END
    );
END;
$$;


--
-- Name: FUNCTION get_invoice_details(p_invoice_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_invoice_details(p_invoice_id uuid) IS 'Returns full invoice details for printing';


--
-- Name: get_item_reviews(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_item_reviews(p_item_id uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN get_public_reviews(NULL, p_item_id, NULL, NULL, p_limit, p_offset, 'helpful');
END;
$$;


--
-- Name: get_kitchen_completed_orders(uuid, text, timestamp with time zone, timestamp with time zone, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_kitchen_completed_orders(p_employee_id uuid DEFAULT NULL::uuid, p_filter_type text DEFAULT 'today'::text, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, order_number text, customer_name text, customer_phone text, order_type text, status text, items jsonb, total_items integer, subtotal numeric, total numeric, notes text, table_number integer, created_at timestamp with time zone, kitchen_started_at timestamp with time zone, kitchen_completed_at timestamp with time zone, prepared_by uuid, prepared_by_name text, prep_time_minutes integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  -- Calculate date range based on filter type
  CASE p_filter_type
    WHEN 'today' THEN
      v_start_date := date_trunc('day', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := v_start_date + interval '1 day';
    WHEN 'week' THEN
      v_start_date := date_trunc('week', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'month' THEN
      v_start_date := date_trunc('month', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'year' THEN
      v_start_date := date_trunc('year', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'custom' THEN
      v_start_date := COALESCE(p_start_date, now() - interval '30 days');
      v_end_date := COALESCE(p_end_date, now());
    ELSE
      v_start_date := date_trunc('day', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := v_start_date + interval '1 day';
  END CASE;

  RETURN QUERY
  SELECT 
    o.id,
    o.order_number::text,
    o.customer_name::text,
    o.customer_phone::text,
    o.order_type::text,
    o.status::text,
    o.items,
    COALESCE(jsonb_array_length(o.items), 0)::int as total_items,
    o.subtotal,
    o.total,
    o.notes,
    o.table_number,
    o.created_at,
    o.kitchen_started_at,
    o.kitchen_completed_at,
    o.prepared_by,
    e.name::text as prepared_by_name,
    CASE 
      WHEN o.kitchen_started_at IS NOT NULL AND o.kitchen_completed_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (o.kitchen_completed_at - o.kitchen_started_at))::int / 60
      ELSE NULL
    END as prep_time_minutes
  FROM orders o
  LEFT JOIN employees e ON e.id = o.prepared_by
  WHERE 
    -- Filter by status (ready, delivered, or completed statuses)
    o.status IN ('ready', 'delivered', 'delivering')
    -- Filter by date range
    AND o.kitchen_completed_at >= v_start_date
    AND o.kitchen_completed_at < v_end_date
    -- Filter by employee if provided
    AND (p_employee_id IS NULL OR o.prepared_by = p_employee_id)
  ORDER BY o.kitchen_completed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


--
-- Name: get_kitchen_completed_stats(uuid, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_kitchen_completed_stats(p_employee_id uuid DEFAULT NULL::uuid, p_filter_type text DEFAULT 'today'::text, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(total_completed bigint, total_items_prepared bigint, avg_prep_time_minutes numeric, fastest_order_minutes integer, slowest_order_minutes integer, total_revenue numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  -- Calculate date range based on filter type
  CASE p_filter_type
    WHEN 'today' THEN
      v_start_date := date_trunc('day', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := v_start_date + interval '1 day';
    WHEN 'week' THEN
      v_start_date := date_trunc('week', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'month' THEN
      v_start_date := date_trunc('month', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'year' THEN
      v_start_date := date_trunc('year', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := now();
    WHEN 'custom' THEN
      v_start_date := COALESCE(p_start_date, now() - interval '30 days');
      v_end_date := COALESCE(p_end_date, now());
    ELSE
      v_start_date := date_trunc('day', now() AT TIME ZONE 'Asia/Karachi');
      v_end_date := v_start_date + interval '1 day';
  END CASE;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_completed,
    COALESCE(SUM(jsonb_array_length(o.items)), 0)::bigint as total_items_prepared,
    ROUND(AVG(
      CASE 
        WHEN o.kitchen_started_at IS NOT NULL AND o.kitchen_completed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (o.kitchen_completed_at - o.kitchen_started_at)) / 60
        ELSE NULL
      END
    ), 1) as avg_prep_time_minutes,
    MIN(
      CASE 
        WHEN o.kitchen_started_at IS NOT NULL AND o.kitchen_completed_at IS NOT NULL 
        THEN (EXTRACT(EPOCH FROM (o.kitchen_completed_at - o.kitchen_started_at)) / 60)::int
        ELSE NULL
      END
    ) as fastest_order_minutes,
    MAX(
      CASE 
        WHEN o.kitchen_started_at IS NOT NULL AND o.kitchen_completed_at IS NOT NULL 
        THEN (EXTRACT(EPOCH FROM (o.kitchen_completed_at - o.kitchen_started_at)) / 60)::int
        ELSE NULL
      END
    ) as slowest_order_minutes,
    COALESCE(SUM(o.total), 0) as total_revenue
  FROM orders o
  WHERE 
    o.status IN ('ready', 'delivered', 'delivering')
    AND o.kitchen_completed_at >= v_start_date
    AND o.kitchen_completed_at < v_end_date
    AND (p_employee_id IS NULL OR o.prepared_by = p_employee_id);
END;
$$;


--
-- Name: get_kitchen_order_detail(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_kitchen_order_detail(p_order_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'order_type', o.order_type,
        'table_number', o.table_number,
        'items', o.items,
        'status', o.status,
        'notes', o.notes,
        'customer_name', o.customer_name,
        'customer_phone', o.customer_phone,
        'customer_email', o.customer_email,
        'customer_address', o.customer_address,
        'subtotal', o.subtotal,
        'discount', o.discount,
        'tax', o.tax,
        'delivery_fee', o.delivery_fee,
        'total', o.total,
        'payment_method', o.payment_method,
        'payment_status', o.payment_status,
        'created_at', o.created_at,
        'kitchen_started_at', o.kitchen_started_at,
        'kitchen_completed_at', o.kitchen_completed_at,
        'waiter', CASE WHEN o.waiter_id IS NOT NULL THEN (
            SELECT json_build_object('id', e.id, 'name', e.name, 'phone', e.phone)
            FROM employees e WHERE e.id = o.waiter_id
        ) ELSE NULL END,
        'table_details', CASE WHEN o.table_number IS NOT NULL THEN (
            SELECT json_build_object(
                'id', rt.id,
                'table_number', rt.table_number,
                'capacity', rt.capacity,
                'section', rt.section,
                'floor', rt.floor,
                'status', rt.status,
                'current_customers', rt.current_customers,
                'assigned_waiter', CASE WHEN rt.assigned_waiter_id IS NOT NULL THEN (
                    SELECT json_build_object('id', ew.id, 'name', ew.name, 'phone', ew.phone)
                    FROM employees ew WHERE ew.id = rt.assigned_waiter_id
                ) ELSE NULL END
            )
            FROM restaurant_tables rt WHERE rt.table_number = o.table_number
            LIMIT 1
        ) ELSE NULL END,
        'status_history', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'status', sh.status,
                    'changed_at', sh.changed_at,
                    'changed_by', (SELECT name FROM employees WHERE id = sh.changed_by)
                ) ORDER BY sh.changed_at DESC
            ), '[]'::json)
            FROM order_status_history sh WHERE sh.order_id = o.id
        )
    ) INTO result
    FROM orders o
    WHERE o.id = p_order_id;
    
    RETURN result;
END;
$$;


--
-- Name: get_kitchen_orders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_kitchen_orders() RETURNS SETOF json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT json_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'order_type', o.order_type,
    'items', o.items,
    'created_at', o.created_at,
    'customer_name', o.customer_name,
    'notes', o.notes,
    'priority', CASE 
      WHEN EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 > 30 THEN 'urgent'
      WHEN EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 > 15 THEN 'high'
      ELSE 'normal'
    END
  )
  FROM orders o
  WHERE o.status IN ('confirmed', 'preparing', 'ready')
    AND DATE(o.created_at) = CURRENT_DATE
  ORDER BY 
    CASE o.status 
      WHEN 'confirmed' THEN 1 
      WHEN 'preparing' THEN 2 
      WHEN 'ready' THEN 3 
    END,
    o.created_at ASC;
END;
$$;


--
-- Name: get_kitchen_orders_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_kitchen_orders_v2() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(order_data ORDER BY priority, created_at) INTO result
    FROM (
        SELECT 
            json_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'table_number', o.table_number,
                'items', o.items,
                'status', o.status,
                'notes', o.notes,
                'customer_name', o.customer_name,
                'customer_phone', o.customer_phone,
                'subtotal', o.subtotal,
                'total', o.total,
                'payment_method', o.payment_method,
                'payment_status', o.payment_status,
                'created_at', o.created_at,
                'kitchen_started_at', o.kitchen_started_at,
                'kitchen_completed_at', o.kitchen_completed_at,
                -- Waiter info
                'waiter', CASE WHEN o.waiter_id IS NOT NULL THEN (
                    SELECT json_build_object('id', e.id, 'name', e.name)
                    FROM employees e WHERE e.id = o.waiter_id
                ) ELSE NULL END,
                -- Table details for dine-in orders
                'table_details', CASE WHEN o.table_number IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', rt.id,
                        'table_number', rt.table_number,
                        'capacity', rt.capacity,
                        'section', rt.section,
                        'floor', rt.floor,
                        'current_customers', rt.current_customers,
                        'assigned_waiter', CASE WHEN rt.assigned_waiter_id IS NOT NULL THEN (
                            SELECT json_build_object('id', ew.id, 'name', ew.name)
                            FROM employees ew WHERE ew.id = rt.assigned_waiter_id
                        ) ELSE NULL END
                    )
                    FROM restaurant_tables rt WHERE rt.table_number = o.table_number
                    LIMIT 1
                ) ELSE NULL END,
                -- Priority: confirmed > preparing > ready, older first
                'priority', CASE o.status 
                    WHEN 'confirmed' THEN 1
                    WHEN 'pending' THEN 2
                    WHEN 'preparing' THEN 3
                    ELSE 4
                END,
                -- Time calculations
                'elapsed_seconds', EXTRACT(EPOCH FROM (NOW() - o.created_at))::INT,
                'prep_elapsed_seconds', CASE 
                    WHEN o.kitchen_started_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (NOW() - o.kitchen_started_at))::INT 
                    ELSE NULL 
                END,
                -- Item count for quick view
                'total_items', (
                    SELECT COALESCE(SUM((item->>'quantity')::INT), 0)
                    FROM jsonb_array_elements(o.items::jsonb) AS item
                )
            ) AS order_data,
            CASE o.status 
                WHEN 'confirmed' THEN 1
                WHEN 'pending' THEN 2
                WHEN 'preparing' THEN 3
                ELSE 4
            END AS priority,
            o.created_at
        FROM orders o
        WHERE o.status IN ('confirmed', 'preparing', 'pending', 'ready')
            AND o.created_at >= CURRENT_DATE
            AND (o.status != 'ready' OR o.kitchen_completed_at >= NOW() - INTERVAL '30 minutes')
    ) sub;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_kitchen_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_kitchen_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'pending_count', (SELECT COUNT(*) FROM orders WHERE status = 'pending' AND created_at >= CURRENT_DATE),
        'confirmed_count', (SELECT COUNT(*) FROM orders WHERE status = 'confirmed' AND created_at >= CURRENT_DATE),
        'preparing_count', (SELECT COUNT(*) FROM orders WHERE status = 'preparing' AND created_at >= CURRENT_DATE),
        'ready_count', (SELECT COUNT(*) FROM orders WHERE status = 'ready' AND kitchen_completed_at >= NOW() - INTERVAL '30 minutes'),
        'total_today', (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE),
        'completed_today', (SELECT COUNT(*) FROM orders WHERE status IN ('delivered', 'ready') AND created_at >= CURRENT_DATE),
        'avg_prep_time_mins', (
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (kitchen_completed_at - kitchen_started_at)) / 60)::numeric, 1)
            FROM orders 
            WHERE kitchen_started_at IS NOT NULL 
                AND kitchen_completed_at IS NOT NULL 
                AND created_at >= CURRENT_DATE
        ),
        'orders_this_hour', (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '1 hour')
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_leave_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_leave_balance() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  emp_id UUID;
  balance_record RECORD;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
  
  IF balance_record IS NULL THEN
    -- Create default balance
    INSERT INTO leave_balances (employee_id) VALUES (emp_id)
    RETURNING * INTO balance_record;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'balance', json_build_object(
      'annual', json_build_object(
        'total', balance_record.annual_leave,
        'used', balance_record.annual_used,
        'available', balance_record.annual_leave - balance_record.annual_used
      ),
      'sick', json_build_object(
        'total', balance_record.sick_leave,
        'used', balance_record.sick_used,
        'available', balance_record.sick_leave - balance_record.sick_used
      ),
      'casual', json_build_object(
        'total', balance_record.casual_leave,
        'used', balance_record.casual_used,
        'available', balance_record.casual_leave - balance_record.casual_used
      ),
      'year', balance_record.year
    )
  );
END;
$$;


--
-- Name: get_leave_balance(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_leave_balance(p_employee_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  emp_id UUID;
  balance_record RECORD;
BEGIN
  emp_id := resolve_employee_id(p_employee_id);
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  
  SELECT * INTO balance_record FROM leave_balances WHERE employee_id = emp_id;
  IF balance_record IS NULL THEN
    INSERT INTO leave_balances (employee_id) VALUES (emp_id) RETURNING * INTO balance_record;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'balance', json_build_object(
      'annual', json_build_object('total', balance_record.annual_leave, 'used', balance_record.annual_used, 'available', balance_record.annual_leave - balance_record.annual_used),
      'sick', json_build_object('total', balance_record.sick_leave, 'used', balance_record.sick_used, 'available', balance_record.sick_leave - balance_record.sick_used),
      'casual', json_build_object('total', balance_record.casual_leave, 'used', balance_record.casual_used, 'available', balance_record.casual_leave - balance_record.casual_used),
      'year', balance_record.year
    )
  );
END;
$$;


--
-- Name: get_low_stock_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_low_stock_items() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', id,
            'name', name,
            'sku', sku,
            'category', category,
            'current_stock', COALESCE(quantity, 0),
            'min_stock', COALESCE(min_quantity, 0),
            'reorder_point', COALESCE(reorder_point, min_quantity, 10),
            'unit', unit,
            'supplier', supplier,
            'cost_per_unit', cost_per_unit,
            'suggested_order_qty', COALESCE(max_quantity, 100) - COALESCE(quantity, 0),
            'estimated_cost', (COALESCE(max_quantity, 100) - COALESCE(quantity, 0)) * COALESCE(cost_per_unit, 0),
            'lead_time_days', COALESCE(lead_time_days, 7),
            'status', CASE 
                WHEN quantity <= 0 THEN 'out_of_stock'
                ELSE 'low_stock'
            END
        )
        ORDER BY 
            CASE WHEN quantity <= 0 THEN 0 ELSE 1 END,
            quantity ASC
    ) INTO result
    FROM inventory
    WHERE COALESCE(is_active, true) = true
    AND (quantity <= 0 OR quantity <= COALESCE(min_quantity, 0));
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_loyalty_balance(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_loyalty_balance(p_customer_id uuid) RETURNS TABLE(total_points integer, redeemable_points integer, pending_points integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'earned' THEN points ELSE -points END), 0)::INT as total,
        COALESCE(SUM(CASE WHEN type = 'earned' AND created_at < NOW() - INTERVAL '24 hours' THEN points 
                      WHEN type = 'redeemed' THEN -points ELSE 0 END), 0)::INT as redeemable,
        COALESCE(SUM(CASE WHEN type = 'earned' AND created_at >= NOW() - INTERVAL '24 hours' THEN points ELSE 0 END), 0)::INT as pending
    FROM loyalty_points
    WHERE customer_id = p_customer_id;
END;
$$;


--
-- Name: get_maintenance_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_maintenance_status() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    maint_record RECORD;
BEGIN
    -- Get the single maintenance mode row
    SELECT * INTO maint_record FROM maintenance_mode LIMIT 1;
    
    IF NOT FOUND THEN
        -- No record, return disabled
        RETURN json_build_object(
            'is_enabled', false,
            'reason_type', 'update',
            'custom_reason', null,
            'title', 'Maintenance Mode',
            'message', null,
            'estimated_restore_time', null,
            'show_timer', true,
            'show_progress', true
        );
    END IF;
    
    -- Build response
    SELECT json_build_object(
        'is_enabled', maint_record.is_enabled,
        'reason_type', maint_record.reason_type,
        'custom_reason', maint_record.custom_reason,
        'title', COALESCE(maint_record.title, 'We''ll Be Right Back'),
        'message', maint_record.message,
        'estimated_restore_time', maint_record.estimated_restore_time,
        'show_timer', COALESCE(maint_record.show_timer, true),
        'show_progress', COALESCE(maint_record.show_progress, true),
        'enabled_at', maint_record.enabled_at
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_maintenance_status(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_maintenance_status() IS 'Public: Check if site is in maintenance mode';


--
-- Name: get_meal_reviews(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_meal_reviews(p_meal_id uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN get_public_reviews(NULL, NULL, p_meal_id, NULL, p_limit, p_offset, 'helpful');
END;
$$;


--
-- Name: get_menu_categories_advanced(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_menu_categories_advanced() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: FUNCTION get_menu_categories_advanced(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_menu_categories_advanced() IS 'Returns all categories with item statistics';


--
-- Name: get_menu_for_ordering(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_menu_for_ordering() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'success', true,
        'categories', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'slug', c.slug,
                    'icon', c.icon,
                    'items_count', (
                        SELECT COUNT(*) FROM menu_items m 
                        WHERE m.category_id = c.id AND m.status = 'available'
                    )
                ) ORDER BY c.display_order, c.name
            ), '[]'::json)
            FROM categories c WHERE c.status = 'active'
        ),
        'items', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', m.id,
                    'name', m.name,
                    'slug', m.slug,
                    'description', m.description,
                    'price', m.price,
                    'category_id', m.category_id,
                    'category_name', c.name,
                    'image_url', m.image_url,
                    'status', m.status,
                    'is_featured', m.is_featured,
                    'spicy_level', m.spicy_level,
                    'is_vegetarian', m.is_vegetarian,
                    'prep_time', m.prep_time
                ) ORDER BY m.name
            ), '[]'::json)
            FROM menu_items m
            JOIN categories c ON c.id = m.category_id
            WHERE m.status = 'available'
        ),
        'deals', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'id', d.id,
                    'name', d.name,
                    'description', d.description,
                    'deal_type', d.deal_type,
                    'discount_type', d.discount_type,
                    'discount_value', d.discount_value,
                    'original_price', d.original_price,
                    'deal_price', d.deal_price,
                    'image_url', d.image_url,
                    'items', d.items,
                    'is_active', d.is_active,
                    'valid_from', d.valid_from,
                    'valid_until', d.valid_until
                ) ORDER BY d.name
            ), '[]'::json)
            FROM deals d
            WHERE d.is_active = true
              AND (d.valid_from IS NULL OR d.valid_from <= NOW())
              AND (d.valid_until IS NULL OR d.valid_until >= NOW())
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_menu_for_ordering(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_menu_for_ordering() IS 'Returns all menu items and deals for order creation';


--
-- Name: get_menu_items_with_ratings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_menu_items_with_ratings() RETURNS TABLE(id uuid, name text, description text, price numeric, category_id uuid, images jsonb, is_available boolean, avg_rating numeric, review_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mi.id,
        mi.name,
        mi.description,
        mi.price,
        mi.category_id,
        mi.images,
        mi.is_available,
        COALESCE(AVG(r.rating), 0)::DECIMAL as avg_rating,
        COUNT(r.id)::BIGINT as review_count
    FROM menu_items mi
    LEFT JOIN orders o ON o.items @> jsonb_build_array(jsonb_build_object('id', mi.id::TEXT))
    LEFT JOIN reviews r ON r.order_id = o.id
    WHERE mi.is_available = true
    GROUP BY mi.id, mi.name, mi.description, mi.price, mi.category_id, mi.images, mi.is_available;
END;
$$;


--
-- Name: get_menu_management_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_menu_management_data() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: FUNCTION get_menu_management_data(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_menu_management_data() IS 'Get all menu data for admin dashboard';


--
-- Name: get_menu_with_categories(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_menu_with_categories(p_category_slug text DEFAULT NULL::text) RETURNS TABLE(id uuid, name text, slug text, description text, price numeric, images jsonb, category_id uuid, category_name text, category_slug text, is_available boolean, is_featured boolean, rating numeric, total_reviews integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mi.id,
        mi.name,
        mi.slug,
        mi.description,
        mi.price,
        mi.images,
        mi.category_id,
        mc.name,
        mc.slug,
        mi.is_available,
        mi.is_featured,
        mi.rating,
        mi.total_reviews
    FROM menu_items mi
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE mi.is_available = TRUE
        AND (p_category_slug IS NULL OR mc.slug = p_category_slug)
    ORDER BY mc.display_order, mi.name;
END;
$$;


--
-- Name: get_my_customer_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_customer_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT id FROM customers 
        WHERE auth_user_id = auth.uid()
    );
END;
$$;


--
-- Name: get_my_employee_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_employee_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT id FROM employees 
        WHERE auth_user_id = auth.uid()
    );
END;
$$;


--
-- Name: get_my_employee_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_employee_profile() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_auth_user_id UUID;
  v_result JSON;
BEGIN
  -- Get the current auth user ID
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Fetch employee profile
  SELECT json_build_object(
    'success', true,
    'employee', json_build_object(
      'id', e.id,
      'auth_user_id', e.auth_user_id,
      'employee_id', e.employee_id,
      'name', e.name,
      'email', e.email,
      'phone', COALESCE(e.phone, ''),
      'address', COALESCE(e.address, ''),
      'emergency_contact', COALESCE(e.emergency_contact, ''),
      'avatar_url', COALESCE(e.avatar_url, ''),
      'role', e.role,
      'hired_date', e.hired_date,
      'is_2fa_enabled', COALESCE(e.is_2fa_enabled, false),
      'status', e.status
    )
  ) INTO v_result
  FROM employees e
  WHERE e.auth_user_id = v_auth_user_id;
  
  IF v_result IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Employee not found');
  END IF;
  
  RETURN v_result;
END;
$$;


--
-- Name: get_my_leave_requests(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_leave_requests(p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_limit integer DEFAULT 50) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  emp_id UUID;
  result JSON;
BEGIN
  emp_id := get_employee_id();
  
  IF emp_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', COALESCE(json_agg(
      json_build_object(
        'id', lr.id,
        'leave_type', lr.leave_type,
        'start_date', lr.start_date,
        'end_date', lr.end_date,
        'total_days', lr.total_days,
        'reason', lr.reason,
        'status', lr.status,
        'reviewed_by', lr.reviewed_by,
        'reviewed_at', lr.reviewed_at,
        'review_notes', lr.review_notes,
        'created_at', lr.created_at,
        'reviewer', CASE WHEN r.id IS NOT NULL THEN
          json_build_object('id', r.id, 'name', r.name, 'role', r.role)
        ELSE NULL END
      ) ORDER BY lr.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM leave_requests lr
  LEFT JOIN employees r ON r.id = lr.reviewed_by
  WHERE lr.employee_id = emp_id
  AND EXTRACT(YEAR FROM lr.start_date) = p_year
  LIMIT p_limit;
  
  RETURN result;
END;
$$;


--
-- Name: get_my_leave_requests(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_leave_requests(p_employee_id uuid, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, p_limit integer DEFAULT 50) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  emp_id UUID;
  result JSON;
BEGIN
  emp_id := resolve_employee_id(p_employee_id);
  IF emp_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', COALESCE(json_agg(
      json_build_object('id', lr.id, 'leave_type', lr.leave_type, 'start_date', lr.start_date, 'end_date', lr.end_date,
        'total_days', lr.total_days, 'reason', lr.reason, 'status', lr.status, 'reviewed_by', lr.reviewed_by,
        'reviewed_at', lr.reviewed_at, 'review_notes', lr.review_notes, 'created_at', lr.created_at,
        'reviewer', CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'name', r.name, 'role', r.role) ELSE NULL END
      ) ORDER BY lr.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM leave_requests lr LEFT JOIN employees r ON r.id = lr.reviewed_by
  WHERE lr.employee_id = emp_id AND EXTRACT(YEAR FROM lr.start_date) = p_year
  LIMIT p_limit;
  
  RETURN result;
END;
$$;


--
-- Name: get_my_notifications(integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_notifications(p_limit integer DEFAULT 50, p_unread_only boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    result JSON;
BEGIN
    emp_id := get_employee_id();
    
    SELECT json_agg(
        json_build_object(
            'id', n.id,
            'title', n.title,
            'message', n.message,
            'type', n.type,
            'is_read', n.is_read,
            'data', n.data,
            'priority', n.priority,
            'created_at', n.created_at
        )
        ORDER BY n.created_at DESC
    ) INTO result
    FROM notifications n
    WHERE n.user_id = emp_id
    AND n.user_type = 'employee'
    AND (NOT p_unread_only OR n.is_read = false)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_my_today_attendance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_today_attendance() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    result JSON;
BEGIN
    emp_id := get_employee_id();
    
    IF emp_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'attendance', CASE WHEN a.id IS NOT NULL THEN
            json_build_object(
                'id', a.id,
                'date', a.date,
                'check_in', a.check_in,
                'check_out', a.check_out,
                'status', a.status,
                'notes', a.notes
            )
        ELSE NULL END
    ) INTO result
    FROM (SELECT 1) dummy
    LEFT JOIN attendance a ON a.employee_id = emp_id AND a.date = CURRENT_DATE;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_my_today_attendance(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_today_attendance() IS 'Returns current employee attendance for today - secure';


--
-- Name: get_new_online_orders(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_new_online_orders(p_since timestamp with time zone DEFAULT (now() - '00:05:00'::interval)) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN json_build_object(
        'success', true,
        'orders', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'customer_name', COALESCE(o.customer_name, 'Online Customer'),
                    'customer_phone', o.customer_phone,
                    'items_count', jsonb_array_length(COALESCE(o.items, '[]'::jsonb)),
                    'total', o.total,
                    'payment_method', o.payment_method,
                    'transaction_id', o.transaction_id,
                    'online_payment_details', o.online_payment_details,
                    'created_at', o.created_at
                ) ORDER BY o.created_at DESC
            )
            FROM orders o
            WHERE o.order_type = 'online'
            AND o.created_at >= p_since
            AND o.status = 'pending'
        ), '[]'::json),
        'count', (
            SELECT COUNT(*)::INT
            FROM orders o
            WHERE o.order_type = 'online'
            AND o.created_at >= p_since
            AND o.status = 'pending'
        )
    );
END;
$$;


--
-- Name: FUNCTION get_new_online_orders(p_since timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_new_online_orders(p_since timestamp with time zone) IS 'Returns new online orders for notification system';


--
-- Name: get_notifications(uuid, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_notifications(p_user_id uuid DEFAULT NULL::uuid, p_user_type text DEFAULT 'employee'::text, p_is_read boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 50) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    emp_id UUID;
BEGIN
    emp_id := COALESCE(p_user_id, get_employee_id());
    
    SELECT json_agg(
        json_build_object(
            'id', n.id,
            'title', n.title,
            'message', n.message,
            'type', n.type,
            'is_read', n.is_read,
            'data', n.data,
            'created_at', n.created_at
        )
        ORDER BY n.created_at DESC
    ) INTO result
    FROM notifications n
    WHERE n.user_id = emp_id
    AND n.user_type = p_user_type
    AND (p_is_read IS NULL OR n.is_read = p_is_read)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_order_creation_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_order_creation_data() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: FUNCTION get_order_creation_data(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_order_creation_data() IS 'Gets all data needed for order creation: menu, categories, tables, deals';


--
-- Name: get_order_details(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_order_details(p_order_id uuid, p_customer_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, order_number text, customer_name text, customer_email text, customer_phone text, customer_address text, items jsonb, subtotal numeric, tax numeric, delivery_fee numeric, discount numeric, total numeric, payment_method public.payment_method, payment_status text, status public.order_status, notes text, assigned_to uuid, assigned_to_name text, assigned_to_phone text, created_at timestamp with time zone, delivered_at timestamp with time zone, status_history jsonb, transaction_id text, online_payment_method_id uuid, online_payment_details jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number::TEXT,
        o.customer_name::TEXT,
        o.customer_email::TEXT,
        o.customer_phone::TEXT,
        o.customer_address,
        o.items,
        o.subtotal,
        o.tax,
        o.delivery_fee,
        o.discount,
        o.total,
        o.payment_method,
        o.payment_status::TEXT,
        o.status,
        o.notes,
        o.assigned_to,
        e.name::TEXT,
        e.phone::TEXT,
        o.created_at,
        o.delivered_at,
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'status', h.status,
                    'notes', h.notes,
                    'created_at', h.created_at
                ) ORDER BY h.created_at DESC
            )
            FROM order_status_history h
            WHERE h.order_id = o.id
        ),
        o.transaction_id,
        o.online_payment_method_id,
        o.online_payment_details
    FROM orders o
    LEFT JOIN employees e ON o.assigned_to = e.id
    WHERE o.id = p_order_id
        AND (p_customer_id IS NULL OR o.customer_id = p_customer_id);
END;
$$;


--
-- Name: FUNCTION get_order_details(p_order_id uuid, p_customer_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_order_details(p_order_id uuid, p_customer_id uuid) IS 'Get full order details for a specific order';


--
-- Name: get_order_for_billing(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_order_for_billing(p_order_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_order RECORD;
    v_customer RECORD;
    v_table RECORD;
    v_waiter RECORD;
    v_existing_invoice RECORD;
    v_customer_json JSON := NULL;
    v_table_json JSON := NULL;
    v_waiter_json JSON := NULL;
    v_invoice_json JSON := NULL;
    result JSON;
BEGIN
    -- Get order
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF v_order IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Check if invoice already exists
    SELECT * INTO v_existing_invoice FROM invoices WHERE order_id = p_order_id;
    IF FOUND THEN
        v_invoice_json := json_build_object(
            'id', v_existing_invoice.id,
            'invoice_number', v_existing_invoice.invoice_number,
            'total', v_existing_invoice.total,
            'status', v_existing_invoice.payment_status,
            'created_at', v_existing_invoice.created_at
        );
    END IF;
    
    -- Get customer details if registered
    IF v_order.customer_id IS NOT NULL THEN
        SELECT c.id, c.name, c.phone, c.email, c.address, c.is_verified,
               COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) as loyalty_points,
               CASE 
                   WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 1000 THEN 'platinum'
                   WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 500 THEN 'gold'
                   WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 250 THEN 'silver'
                   ELSE 'bronze'
               END as loyalty_tier,
               COALESCE((SELECT COUNT(*) FROM orders WHERE customer_id = c.id), 0)::INT as total_orders,
               COALESCE((SELECT SUM(total) FROM orders WHERE customer_id = c.id AND payment_status = 'paid'), 0) as total_spent
        INTO v_customer
        FROM customers c
        WHERE c.id = v_order.customer_id;
        
        IF FOUND THEN
            v_customer_json := json_build_object(
                'id', v_customer.id,
                'name', v_customer.name,
                'phone', v_customer.phone,
                'email', v_customer.email,
                'address', v_customer.address,
                'is_verified', v_customer.is_verified,
                'loyalty_points', COALESCE(v_customer.loyalty_points, 0),
                'loyalty_tier', COALESCE(v_customer.loyalty_tier, 'bronze'),
                'total_orders', v_customer.total_orders,
                'total_spent', v_customer.total_spent
            );
        END IF;
    END IF;
    
    -- Default customer JSON if not found
    IF v_customer_json IS NULL THEN
        v_customer_json := json_build_object(
            'name', COALESCE(v_order.customer_name, 'Walk-in Customer'),
            'phone', v_order.customer_phone,
            'email', v_order.customer_email,
            'address', v_order.customer_address,
            'is_registered', false
        );
    END IF;
    
    -- Get table details if dine-in
    IF v_order.table_number IS NOT NULL THEN
        SELECT * INTO v_table FROM restaurant_tables WHERE table_number = v_order.table_number;
        IF FOUND THEN
            v_table_json := json_build_object(
                'id', v_table.id,
                'table_number', v_table.table_number,
                'capacity', v_table.capacity,
                'section', v_table.section,
                'floor', v_table.floor,
                'current_customers', v_table.current_customers
            );
        END IF;
    END IF;
    
    -- Get waiter details
    IF v_order.waiter_id IS NOT NULL THEN
        SELECT id, name, phone, employee_id INTO v_waiter FROM employees WHERE id = v_order.waiter_id;
        IF FOUND THEN
            v_waiter_json := json_build_object(
                'id', v_waiter.id,
                'name', v_waiter.name,
                'employee_id', v_waiter.employee_id
            );
        END IF;
    END IF;
    
    -- Build final result
    SELECT json_build_object(
        'success', true,
        'order', json_build_object(
            'id', v_order.id,
            'order_number', v_order.order_number,
            'order_type', v_order.order_type,
            'status', v_order.status,
            'payment_status', v_order.payment_status,
            'items', v_order.items,
            'items_count', jsonb_array_length(COALESCE(v_order.items, '[]'::jsonb)),
            'subtotal', v_order.subtotal,
            'discount', v_order.discount,
            'tax', v_order.tax,
            'delivery_fee', v_order.delivery_fee,
            'total', v_order.total,
            'notes', v_order.notes,
            'created_at', v_order.created_at,
            'transaction_id', v_order.transaction_id,
            'online_payment_method_id', v_order.online_payment_method_id,
            'online_payment_details', v_order.online_payment_details
        ),
        'customer', v_customer_json,
        'table', v_table_json,
        'waiter', v_waiter_json,
        'existing_invoice', v_invoice_json,
        'brand_info', (
            SELECT brand_info FROM invoices LIMIT 1
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_order_for_billing(p_order_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_order_for_billing(p_order_id uuid) IS 'Returns detailed order info for invoice generation';


--
-- Name: get_orders_advanced(text, text, date, date, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_orders_advanced(p_status text DEFAULT NULL::text, p_order_type text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    total_count INT;
BEGIN
    -- Get total count first (for pagination)
    SELECT COUNT(*) INTO total_count
    FROM orders o
    WHERE (p_status IS NULL OR o.status::TEXT = p_status)
      AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
      AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date);

    -- Get orders with full details
    SELECT json_build_object(
        'orders', COALESCE(json_agg(order_data ORDER BY created_at DESC), '[]'::json),
        'total_count', total_count,
        'has_more', (p_offset + p_limit) < total_count
    ) INTO result
    FROM (
        SELECT 
            json_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'status', o.status,
                
                -- Customer info (direct fields)
                'customer_name', o.customer_name,
                'customer_phone', o.customer_phone,
                'customer_email', o.customer_email,
                'customer_address', o.customer_address,
                
                -- Registered customer details (if customer_id exists)
                'customer', CASE WHEN o.customer_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', c.id,
                        'name', c.name,
                        'phone', c.phone,
                        'email', c.email,
                        'address', c.address
                    )
                    FROM customers c WHERE c.id = o.customer_id
                ) ELSE NULL END,
                
                -- Items
                'items', o.items,
                'total_items', (
                    SELECT COALESCE(SUM((item->>'quantity')::INT), 0)
                    FROM jsonb_array_elements(o.items::jsonb) AS item
                ),
                
                -- Pricing
                'subtotal', o.subtotal,
                'discount', o.discount,
                'tax', o.tax,
                'delivery_fee', o.delivery_fee,
                'total', o.total,
                
                -- Payment
                'payment_method', o.payment_method,
                'payment_status', o.payment_status,
                'payment_proof_url', o.payment_proof_url,
                'transaction_id', o.transaction_id,
                'online_payment_method_id', o.online_payment_method_id,
                'online_payment_details', o.online_payment_details,
                
                -- Notes
                'notes', o.notes,
                'cancellation_reason', o.cancellation_reason,
                
                -- Table details (for dine-in)
                'table_number', o.table_number,
                'table_details', CASE WHEN o.table_number IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', rt.id,
                        'table_number', rt.table_number,
                        'capacity', rt.capacity,
                        'section', rt.section,
                        'floor', rt.floor,
                        'status', rt.status,
                        'current_customers', rt.current_customers
                    )
                    FROM restaurant_tables rt 
                    WHERE rt.table_number = o.table_number
                    LIMIT 1
                ) ELSE NULL END,
                
                -- Waiter info
                'waiter_id', o.waiter_id,
                'waiter', CASE WHEN o.waiter_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', e.id,
                        'name', e.name,
                        'phone', e.phone,
                        'avatar_url', e.avatar_url
                    )
                    FROM employees e WHERE e.id = o.waiter_id
                ) ELSE NULL END,
                
                -- Kitchen staff
                'prepared_by', CASE WHEN o.prepared_by IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', e.id,
                        'name', e.name
                    )
                    FROM employees e WHERE e.id = o.prepared_by
                ) ELSE NULL END,
                
                -- Delivery rider (for delivery orders)
                'delivery_rider_id', o.delivery_rider_id,
                'delivery_rider', CASE WHEN o.delivery_rider_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', e.id,
                        'name', e.name,
                        'phone', e.phone,
                        'avatar_url', e.avatar_url
                    )
                    FROM employees e WHERE e.id = o.delivery_rider_id
                ) ELSE NULL END,
                
                -- Timestamps
                'created_at', o.created_at,
                'updated_at', o.updated_at,
                'kitchen_started_at', o.kitchen_started_at,
                'kitchen_completed_at', o.kitchen_completed_at,
                'delivery_started_at', o.delivery_started_at,
                'estimated_delivery_time', o.estimated_delivery_time,
                'delivered_at', o.delivered_at,
                'can_cancel_until', o.can_cancel_until,
                'customer_notified', o.customer_notified,
                
                -- Calculated fields
                'elapsed_seconds', EXTRACT(EPOCH FROM (NOW() - o.created_at))::INT,
                'is_delayed', CASE 
                    WHEN o.status IN ('pending', 'confirmed') 
                        AND EXTRACT(EPOCH FROM (NOW() - o.created_at)) > 300 -- 5 minutes
                    THEN true
                    WHEN o.status = 'preparing' 
                        AND o.kitchen_started_at IS NOT NULL
                        AND EXTRACT(EPOCH FROM (NOW() - o.kitchen_started_at)) > 900 -- 15 minutes
                    THEN true
                    ELSE false
                END,
                'can_cancel', o.status IN ('pending', 'confirmed') 
                    AND (o.can_cancel_until IS NULL OR o.can_cancel_until > NOW())
            ) AS order_data,
            o.created_at
        FROM orders o
        WHERE (p_status IS NULL OR o.status::TEXT = p_status)
          AND (p_order_type IS NULL OR o.order_type::TEXT = p_order_type)
          AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
          AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date)
        ORDER BY o.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) sub;

    RETURN result;
END;
$$;


--
-- Name: get_orders_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_orders_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_today', (
            SELECT COUNT(*) FROM orders WHERE created_at::DATE = CURRENT_DATE
        ),
        'pending_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'pending'
        ),
        'confirmed_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'confirmed'
        ),
        'preparing_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'preparing'
        ),
        'ready_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'ready'
        ),
        'delivering_count', (
            SELECT COUNT(*) FROM orders WHERE status = 'delivering'
        ),
        'completed_today', (
            SELECT COUNT(*) FROM orders 
            WHERE status IN ('delivered', 'ready') 
            AND created_at::DATE = CURRENT_DATE
        ),
        'cancelled_today', (
            SELECT COUNT(*) FROM orders 
            WHERE status = 'cancelled' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'revenue_today', (
            SELECT COALESCE(SUM(total), 0) FROM orders 
            WHERE payment_status = 'paid' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'avg_order_value', (
            SELECT COALESCE(AVG(total), 0)::INT FROM orders 
            WHERE created_at::DATE = CURRENT_DATE
        ),
        'dine_in_count', (
            SELECT COUNT(*) FROM orders 
            WHERE order_type = 'dine-in' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'online_count', (
            SELECT COUNT(*) FROM orders 
            WHERE order_type = 'online' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'walk_in_count', (
            SELECT COUNT(*) FROM orders 
            WHERE order_type = 'walk-in' 
            AND created_at::DATE = CURRENT_DATE
        ),
        'delayed_orders', (
            SELECT COUNT(*) FROM orders 
            WHERE status IN ('pending', 'confirmed') 
            AND EXTRACT(EPOCH FROM (NOW() - created_at)) > 300
        ),
        'long_prep_orders', (
            SELECT COUNT(*) FROM orders 
            WHERE status = 'preparing' 
            AND kitchen_started_at IS NOT NULL
            AND EXTRACT(EPOCH FROM (NOW() - kitchen_started_at)) > 900
        )
    ) INTO result;

    RETURN result;
END;
$$;


--
-- Name: get_payroll_dashboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_payroll_dashboard() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_payroll', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips
        ),
        'total_paid', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips WHERE status = 'paid'
        ),
        'pending_count', (
            SELECT COUNT(*) FROM payslips WHERE status = 'pending'
        ),
        'pending_amount', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips WHERE status = 'pending'
        ),
        'paid_this_month', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips
            WHERE status = 'paid' AND paid_at >= date_trunc('month', CURRENT_DATE)
        ),
        'paid_last_month', (
            SELECT COALESCE(SUM(net_salary), 0) FROM payslips
            WHERE status = 'paid'
            AND paid_at >= date_trunc('month', CURRENT_DATE - interval '1 month')
            AND paid_at < date_trunc('month', CURRENT_DATE)
        ),
        'total_employees', (
            SELECT COUNT(*) FROM employees WHERE status = 'active'
        ),
        'total_salary_budget', (
            SELECT COALESCE(SUM(salary), 0) FROM employees WHERE status = 'active' AND salary IS NOT NULL
        ),
        'payslips_this_month', (
            SELECT COUNT(*) FROM payslips
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'avg_salary', (
            SELECT COALESCE(ROUND(AVG(salary), 2), 0) FROM employees WHERE status = 'active' AND salary IS NOT NULL
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_payroll_summary(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_payroll_summary(p_period_start date DEFAULT NULL::date, p_period_end date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_build_object(
        'total_payroll', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE (p_period_start IS NULL OR period_start >= p_period_start)
            AND (p_period_end IS NULL OR period_end <= p_period_end)
        ),
        'pending_count', (
            SELECT COUNT(*)
            FROM payslips
            WHERE status = 'pending'
        ),
        'pending_amount', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE status = 'pending'
        ),
        'paid_this_month', (
            SELECT COALESCE(SUM(net_salary), 0)
            FROM payslips
            WHERE status = 'paid'
            AND paid_at >= date_trunc('month', CURRENT_DATE)
        ),
        'employees_count', (
            SELECT COUNT(*)
            FROM employees
            WHERE status = 'active'
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_payslip_detail(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_payslip_detail(p_payslip_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'payslip', (
            SELECT json_build_object(
                'id', p.id,
                'period_start', p.period_start,
                'period_end', p.period_end,
                'base_salary', p.base_salary,
                'overtime_hours', p.overtime_hours,
                'overtime_rate', p.overtime_rate,
                'bonuses', p.bonuses,
                'deductions', p.deductions,
                'tax_amount', p.tax_amount,
                'net_salary', p.net_salary,
                'status', p.status,
                'payment_method', p.payment_method,
                'paid_at', p.paid_at,
                'notes', p.notes,
                'created_at', p.created_at,
                'created_by_name', (SELECT cb.name FROM employees cb WHERE cb.id = p.created_by)
            ) FROM payslips p WHERE p.id = p_payslip_id
        ),
        'employee', (
            SELECT json_build_object(
                'id', e.id,
                'name', e.name,
                'email', e.email,
                'phone', e.phone,
                'role', e.role,
                'employee_id', e.employee_id,
                'hired_date', e.hired_date,
                'salary', e.salary,
                'bank_details', e.bank_details,
                'avatar_url', e.avatar_url,
                'address', e.address,
                'date_of_birth', e.date_of_birth,
                'blood_group', e.blood_group
            ) FROM employees e 
            JOIN payslips p ON p.employee_id = e.id 
            WHERE p.id = p_payslip_id
        ),
        'company', json_build_object(
            'name', 'ZOIRO Broast',
            'tagline', 'Injected Broast - Saucy. Juicy. Crispy.',
            'email', 'info@zoiro.com',
            'phone', '+92 XXX XXXXXXX',
            'address', 'Main Branch, City',
            'ntn', 'XXXXXXX',
            'logo_url', '/assets/logo.png'
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_payslips(uuid, text, date, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_payslips(p_employee_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 100) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'employee_id', p.employee_id,
            'employee', (
                SELECT json_build_object(
                    'id', e.id, 
                    'name', e.name, 
                    'role', e.role, 
                    'employee_id', e.employee_id
                )
                FROM employees e WHERE e.id = p.employee_id
            ),
            'period_start', p.period_start,
            'period_end', p.period_end,
            'base_salary', p.base_salary,
            'overtime_hours', p.overtime_hours,
            'overtime_rate', p.overtime_rate,
            'bonuses', p.bonuses,
            'deductions', p.deductions,
            'tax_amount', p.tax_amount,
            'net_salary', p.net_salary,
            'status', p.status,
            'payment_method', p.payment_method,
            'paid_at', p.paid_at,
            'notes', p.notes,
            'created_at', p.created_at
        )
        ORDER BY p.period_end DESC
    ) INTO result
    FROM payslips p
    WHERE (p_employee_id IS NULL OR p.employee_id = p_employee_id)
    AND (p_status IS NULL OR p.status = p_status)
    AND (p_start_date IS NULL OR p.period_start >= p_start_date)
    AND (p_end_date IS NULL OR p.period_end <= p_end_date)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_payslips_advanced(uuid, text, date, date, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_payslips_advanced(p_employee_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_limit integer DEFAULT 50) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    total_count INTEGER;
    v_offset INTEGER;
BEGIN
    v_offset := (p_page - 1) * p_limit;
    
    -- Get total count
    SELECT COUNT(*) INTO total_count
    FROM payslips p
    JOIN employees e ON e.id = p.employee_id
    WHERE (p_employee_id IS NULL OR p.employee_id = p_employee_id)
    AND (p_status IS NULL OR p.status = p_status)
    AND (p_start_date IS NULL OR p.period_start >= p_start_date)
    AND (p_end_date IS NULL OR p.period_end <= p_end_date)
    AND (p_search IS NULL OR e.name ILIKE '%' || p_search || '%' OR e.employee_id ILIKE '%' || p_search || '%');
    
    -- Get paginated data
    SELECT json_build_object(
        'payslips', COALESCE((
            SELECT json_agg(sub ORDER BY sub.period_end DESC)
            FROM (
                SELECT 
                    p.id,
                    p.employee_id,
                    json_build_object(
                        'id', e.id,
                        'name', e.name,
                        'role', e.role,
                        'employee_id', e.employee_id,
                        'avatar_url', e.avatar_url,
                        'email', e.email,
                        'phone', e.phone
                    ) as employee,
                    p.period_start,
                    p.period_end,
                    p.base_salary,
                    p.overtime_hours,
                    p.overtime_rate,
                    p.bonuses,
                    p.deductions,
                    p.tax_amount,
                    p.net_salary,
                    p.status,
                    p.payment_method,
                    p.paid_at,
                    p.notes,
                    p.created_by,
                    (SELECT cb.name FROM employees cb WHERE cb.id = p.created_by) as created_by_name,
                    p.created_at,
                    p.updated_at
                FROM payslips p
                JOIN employees e ON e.id = p.employee_id
                WHERE (p_employee_id IS NULL OR p.employee_id = p_employee_id)
                AND (p_status IS NULL OR p.status = p_status)
                AND (p_start_date IS NULL OR p.period_start >= p_start_date)
                AND (p_end_date IS NULL OR p.period_end <= p_end_date)
                AND (p_search IS NULL OR e.name ILIKE '%' || p_search || '%' OR e.employee_id ILIKE '%' || p_search || '%')
                ORDER BY p.period_end DESC
                LIMIT p_limit OFFSET v_offset
            ) sub
        ), '[]'::json),
        'total_count', total_count,
        'page', p_page,
        'total_pages', CEIL(total_count::float / p_limit)
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_pending_leave_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_leave_count() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'pending_count', (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending')
  );
END;
$$;


--
-- Name: get_pending_leave_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_leave_count(p_caller_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT check_manager_or_admin(p_caller_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  RETURN json_build_object('success', true, 'pending_count', (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'));
END;
$$;


--
-- Name: get_public_reviews(text, uuid, uuid, integer, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_reviews(p_review_type text DEFAULT NULL::text, p_item_id uuid DEFAULT NULL::uuid, p_meal_id uuid DEFAULT NULL::uuid, p_min_rating integer DEFAULT NULL::integer, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_sort text DEFAULT 'recent'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_recent_invoices(timestamp with time zone, timestamp with time zone, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recent_invoices(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_payment_method text DEFAULT NULL::text, p_limit integer DEFAULT 50) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_invoices JSON;
BEGIN
    SELECT COALESCE(json_agg(invoice_row ORDER BY created_at DESC), '[]'::json)
    INTO v_invoices
    FROM (
        SELECT 
            i.id,
            i.invoice_number,
            i.order_type,
            i.customer_name,
            i.customer_phone,
            i.customer_email,
            i.items,
            i.subtotal,
            i.discount,
            i.tax,
            i.service_charge,
            i.delivery_fee,
            i.tip,
            i.total,
            i.payment_method,
            i.payment_status,
            i.bill_status,
            i.table_number,
            i.printed as is_printed,
            i.promo_code_value,
            i.loyalty_points_earned,
            i.loyalty_points_used,
            CASE WHEN i.bill_status = 'void' THEN true ELSE false END as is_voided,
            i.void_reason,
            i.created_at,
            json_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'order_type', o.order_type,
                'table_number', o.table_number,
                'transaction_id', o.transaction_id,
                'online_payment_method_id', o.online_payment_method_id,
                'online_payment_details', o.online_payment_details
            ) as "order",
            o.transaction_id,
            o.online_payment_details,
            CASE WHEN i.customer_id IS NOT NULL THEN
                json_build_object(
                    'id', c.id,
                    'name', COALESCE(i.customer_name, c.name),
                    'phone', c.phone,
                    'email', c.email,
                    'is_registered', true,
                    'loyalty_tier', CASE 
                        WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 1000 THEN 'platinum'
                        WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 500 THEN 'gold'
                        WHEN COALESCE((SELECT SUM(points) FROM loyalty_points WHERE customer_id = c.id), 0) >= 250 THEN 'silver'
                        ELSE 'bronze'
                    END
                )
            ELSE
                json_build_object(
                    'name', i.customer_name,
                    'phone', i.customer_phone,
                    'is_registered', false
                )
            END as customer,
            CASE WHEN i.promo_code_id IS NOT NULL THEN
                json_build_object(
                    'id', pc.id,
                    'code', pc.code,
                    'name', pc.name
                )
            ELSE NULL END as promo_code
        FROM invoices i
        LEFT JOIN orders o ON i.order_id = o.id
        LEFT JOIN customers c ON i.customer_id = c.id
        LEFT JOIN promo_codes pc ON i.promo_code_id = pc.id
        WHERE 
            (p_start_date IS NULL OR i.created_at >= p_start_date)
            AND (p_end_date IS NULL OR i.created_at <= p_end_date)
            AND (p_payment_method IS NULL OR i.payment_method = p_payment_method)
        ORDER BY i.created_at DESC
        LIMIT p_limit
    ) invoice_row;
    
    RETURN v_invoices;
END;
$$;


--
-- Name: FUNCTION get_recent_invoices(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_payment_method text, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_recent_invoices(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_payment_method text, p_limit integer) IS 'Returns list of invoices with filters';


--
-- Name: get_review_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_review_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_reviews', (SELECT COUNT(*) FROM reviews),
        'average_rating', (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews),
        'five_star', (SELECT COUNT(*) FROM reviews WHERE rating = 5),
        'four_star', (SELECT COUNT(*) FROM reviews WHERE rating = 4),
        'three_star', (SELECT COUNT(*) FROM reviews WHERE rating = 3),
        'two_star', (SELECT COUNT(*) FROM reviews WHERE rating = 2),
        'one_star', (SELECT COUNT(*) FROM reviews WHERE rating = 1),
        'pending_replies', (SELECT COUNT(*) FROM reviews WHERE admin_reply IS NULL),
        'this_week', (SELECT COUNT(*) FROM reviews WHERE created_at >= NOW() - INTERVAL '7 days')
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_rider_active_deliveries(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rider_active_deliveries(p_rider_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Validate rider
    IF NOT EXISTS(SELECT 1 FROM employees WHERE id = p_rider_id AND role = 'delivery_rider') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid rider');
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'rider_id', p_rider_id,
        'active_orders', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'status', o.status,
                    'customer_name', o.customer_name,
                    'customer_phone', o.customer_phone,
                    'customer_address', o.customer_address,
                    'items', o.items,
                    'total_items', COALESCE(jsonb_array_length(o.items), 0),
                    'total', o.total,
                    'payment_method', o.payment_method,
                    'payment_status', o.payment_status,
                    'notes', o.notes,
                    'delivery_started_at', o.delivery_started_at,
                    'minutes_elapsed', EXTRACT(EPOCH FROM (NOW() - o.delivery_started_at)) / 60
                ) ORDER BY o.delivery_started_at
            ), '[]'::jsonb)
            FROM orders o
            WHERE o.delivery_rider_id = p_rider_id
              AND o.order_type = 'online'
              AND o.status IN ('delivering', 'out_for_delivery')
        ),
        'count', (
            SELECT COUNT(*)
            FROM orders
            WHERE delivery_rider_id = p_rider_id
              AND order_type = 'online'
              AND status IN ('delivering', 'out_for_delivery')
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: FUNCTION get_rider_active_deliveries(p_rider_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_rider_active_deliveries(p_rider_id uuid) IS 'Returns current active deliveries for a rider';


--
-- Name: get_rider_complete_history(uuid, text, date, date, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rider_complete_history(p_rider_id uuid, p_status text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_is_valid_rider BOOLEAN;
    v_result JSONB;
    v_total_count INT;
    v_orders JSONB;
    v_stats JSONB;
BEGIN
    -- Validate rider exists and is a delivery_rider
    SELECT EXISTS(
        SELECT 1 FROM employees 
        WHERE id = p_rider_id 
        AND role = 'delivery_rider'
    ) INTO v_is_valid_rider;
    
    IF NOT v_is_valid_rider THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Invalid or non-existent delivery rider ID'
        );
    END IF;
    
    -- Count total matching orders
    SELECT COUNT(*) INTO v_total_count
    FROM orders o
    WHERE o.delivery_rider_id = p_rider_id
      AND o.order_type = 'online'
      AND (p_status IS NULL OR o.status::TEXT = p_status)
      AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date);
    
    -- Get orders with all details
    SELECT COALESCE(jsonb_agg(order_data ORDER BY order_data->>'created_at' DESC), '[]'::jsonb)
    INTO v_orders
    FROM (
        SELECT jsonb_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'status', o.status,
            'order_type', o.order_type,
            
            -- Customer details
            'customer', jsonb_build_object(
                'id', o.customer_id,
                'name', o.customer_name,
                'email', o.customer_email,
                'phone', o.customer_phone,
                'address', o.customer_address
            ),
            
            -- Items with details
            'items', o.items,
            'total_items', COALESCE(jsonb_array_length(o.items), 0),
            
            -- Financial details
            'subtotal', o.subtotal,
            'tax', o.tax,
            'delivery_fee', o.delivery_fee,
            'discount', o.discount,
            'total', o.total,
            
            -- Payment info
            'payment_method', o.payment_method,
            'payment_status', o.payment_status,
            'transaction_id', o.transaction_id,
            
            -- Delivery info
            'delivery_address', o.customer_address,
            'delivery_instructions', o.notes,
            'estimated_delivery_time', o.estimated_delivery_time,
            
            -- Timestamps
            'created_at', o.created_at,
            'updated_at', o.updated_at,
            'confirmed_at', o.confirmed_at,
            'preparing_started_at', o.preparing_started_at,
            'ready_at', o.ready_at,
            'delivery_started_at', o.delivery_started_at,
            'delivered_at', o.delivered_at,
            'cancelled_at', o.cancelled_at,
            
            -- Calculate delivery duration in minutes
            'delivery_duration_minutes', 
                CASE 
                    WHEN o.delivered_at IS NOT NULL AND o.delivery_started_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (o.delivered_at - o.delivery_started_at)) / 60
                    ELSE NULL 
                END,
            
            -- Notes
            'notes', o.notes,
            'cancellation_reason', o.cancellation_reason
            
        ) AS order_data
        FROM orders o
        WHERE o.delivery_rider_id = p_rider_id
          AND o.order_type = 'online'
          AND (p_status IS NULL OR o.status::TEXT = p_status)
          AND (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
          AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date)
        ORDER BY o.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) sub;
    
    -- Calculate comprehensive stats
    SELECT jsonb_build_object(
        -- Delivery counts
        'total_assigned', COUNT(*),
        'total_delivered', COUNT(*) FILTER (WHERE status = 'delivered'),
        'total_delivering', COUNT(*) FILTER (WHERE status = 'delivering' OR status = 'out_for_delivery'),
        'total_cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'total_returned', COUNT(*) FILTER (WHERE status = 'returned'),
        
        -- Today's stats
        'today_delivered', COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
        'today_assigned', COUNT(*) FILTER (WHERE created_at::DATE = CURRENT_DATE),
        'today_cancelled', COUNT(*) FILTER (WHERE status = 'cancelled' AND cancelled_at::DATE = CURRENT_DATE),
        
        -- This week stats
        'week_delivered', COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'),
        'week_assigned', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        
        -- This month stats
        'month_delivered', COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)),
        'month_assigned', COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)),
        
        -- Financial stats
        'total_earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0),
        'today_earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at::DATE = CURRENT_DATE), 0),
        'week_earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
        'month_earnings', COALESCE(SUM(total) FILTER (WHERE status = 'delivered' AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)), 0),
        'avg_order_value', ROUND(AVG(total) FILTER (WHERE status = 'delivered'), 2),
        
        -- Delivery fee stats
        'total_delivery_fees', COALESCE(SUM(delivery_fee) FILTER (WHERE status = 'delivered'), 0),
        'today_delivery_fees', COALESCE(SUM(delivery_fee) FILTER (WHERE status = 'delivered' AND delivered_at::DATE = CURRENT_DATE), 0),
        
        -- Time stats (average delivery time in minutes)
        'avg_delivery_minutes', ROUND(
            AVG(
                EXTRACT(EPOCH FROM (delivered_at - delivery_started_at)) / 60
            ) FILTER (WHERE delivered_at IS NOT NULL AND delivery_started_at IS NOT NULL)
        ),
        'fastest_delivery_minutes', ROUND(
            MIN(
                EXTRACT(EPOCH FROM (delivered_at - delivery_started_at)) / 60
            ) FILTER (WHERE delivered_at IS NOT NULL AND delivery_started_at IS NOT NULL)
        ),
        'slowest_delivery_minutes', ROUND(
            MAX(
                EXTRACT(EPOCH FROM (delivered_at - delivery_started_at)) / 60
            ) FILTER (WHERE delivered_at IS NOT NULL AND delivery_started_at IS NOT NULL)
        ),
        
        -- Payment method breakdown
        'cash_orders', COUNT(*) FILTER (WHERE payment_method = 'cash' AND status = 'delivered'),
        'card_orders', COUNT(*) FILTER (WHERE payment_method = 'card' AND status = 'delivered'),
        'online_payment_orders', COUNT(*) FILTER (WHERE payment_method = 'online' AND status = 'delivered'),
        'wallet_orders', COUNT(*) FILTER (WHERE payment_method = 'wallet' AND status = 'delivered'),
        
        -- Cash to collect (COD orders delivered)
        'cash_to_collect_today', COALESCE(
            SUM(total) FILTER (WHERE payment_method = 'cash' AND status = 'delivered' AND delivered_at::DATE = CURRENT_DATE), 
            0
        ),
        
        -- Success rate
        'success_rate', CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE status = 'delivered')::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
            ELSE 0 
        END
    ) INTO v_stats
    FROM orders
    WHERE delivery_rider_id = p_rider_id
      AND order_type = 'online';
    
    -- Build final result
    v_result := jsonb_build_object(
        'success', true,
        'rider_id', p_rider_id,
        'orders', v_orders,
        'total_count', v_total_count,
        'page_size', p_limit,
        'page_offset', p_offset,
        'has_more', (p_offset + p_limit) < v_total_count,
        'stats', v_stats,
        'filters_applied', jsonb_build_object(
            'status', p_status,
            'start_date', p_start_date,
            'end_date', p_end_date
        )
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;


--
-- Name: FUNCTION get_rider_complete_history(p_rider_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_rider_complete_history(p_rider_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer, p_offset integer) IS 'Returns complete delivery history for a rider from orders table with comprehensive stats';


--
-- Name: get_rider_dashboard_stats(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rider_dashboard_stats(p_rider_id uuid, p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_deliveries', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
    ), 0),
    'total_deliveries_today', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) = CURRENT_DATE
    ), 0),
    'pending_deliveries', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND status IN ('assigned', 'picked_up')
    ), 0),
    'completed', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'completed_today', COALESCE((
      SELECT COUNT(*)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'delivered'
    ), 0),
    'total_tips', COALESCE((
      SELECT SUM(tip_amount)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
    ), 0),
    'avg_delivery_time', COALESCE((
      SELECT AVG(EXTRACT(EPOCH FROM (delivered_at - picked_up_at))/60)
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND delivered_at IS NOT NULL
        AND picked_up_at IS NOT NULL
    ), 25),
    'total_earnings', COALESCE((
      SELECT SUM(delivery_fee + COALESCE(tip_amount, 0))
      FROM delivery_history
      WHERE rider_id = p_rider_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status = 'delivered'
    ), 0),
    'pending_orders', (
      SELECT json_agg(json_build_object(
        'id', dh.id,
        'order_id', dh.order_id,
        'order_number', o.order_number,
        'customer_name', o.customer_name,
        'customer_phone', o.customer_phone,
        'customer_address', o.customer_address,
        'total', o.total,
        'status', dh.status,
        'created_at', dh.created_at
      ))
      FROM delivery_history dh
      JOIN orders o ON o.id = dh.order_id
      WHERE dh.rider_id = p_rider_id
        AND dh.status IN ('assigned', 'picked_up')
      ORDER BY dh.created_at ASC
    ),
    'date_range', json_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;


--
-- Name: get_rider_delivery_history(uuid, text, date, date, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_rider_delivery_history(p_rider_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rider_id UUID;
    v_is_valid_rider BOOLEAN;
    result JSON;
    total_count INT;
BEGIN
    -- Determine rider ID: use explicit parameter or fall back to auth
    IF p_rider_id IS NOT NULL THEN
        -- Verify the provided rider_id exists and is a delivery rider
        SELECT EXISTS(
            SELECT 1 FROM employees 
            WHERE id = p_rider_id 
            AND role = 'delivery_rider' 
            AND status = 'active'
        ) INTO v_is_valid_rider;
        
        IF NOT v_is_valid_rider THEN
            RETURN json_build_object('success', false, 'error', 'Invalid rider ID');
        END IF;
        
        v_rider_id := p_rider_id;
    ELSE
        -- Fall back to getting rider from auth context
        v_rider_id := get_employee_id();
    END IF;
    
    -- Final check
    IF v_rider_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated - no rider ID provided');
    END IF;
    
    -- Count total matching records
    SELECT COUNT(*) INTO total_count
    FROM delivery_history dh
    WHERE dh.rider_id = v_rider_id
      AND (p_status IS NULL OR dh.delivery_status = p_status)
      AND (p_start_date IS NULL OR dh.accepted_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR dh.accepted_at::DATE <= p_end_date);
    
    -- Build result
    SELECT json_build_object(
        'success', true,
        'rider_id', v_rider_id,  -- Return the rider_id for debugging
        'history', COALESCE(json_agg(
            json_build_object(
                'id', dh.id,
                'order_id', dh.order_id,
                'order_number', dh.order_number,
                'customer_name', dh.customer_name,
                'customer_phone', dh.customer_phone,
                'customer_address', dh.customer_address,
                'items', dh.items,
                'total_items', dh.total_items,
                'total', dh.total,
                'payment_method', dh.payment_method,
                'delivery_status', dh.delivery_status,
                'accepted_at', dh.accepted_at,
                'started_at', dh.started_at,
                'delivered_at', dh.delivered_at,
                'actual_delivery_minutes', dh.actual_delivery_minutes,
                'customer_rating', dh.customer_rating
            ) ORDER BY dh.accepted_at DESC
        ), '[]'::json),
        'total_count', total_count,
        'has_more', (p_offset + p_limit) < total_count,
        -- Quick stats for this rider
        'stats', (
            SELECT json_build_object(
                'total_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivered'),
                'total_today', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at::DATE = CURRENT_DATE),
                'total_this_week', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at >= CURRENT_DATE - INTERVAL '7 days'),
                'total_this_month', COUNT(*) FILTER (WHERE delivery_status = 'delivered' AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)),
                'avg_delivery_minutes', ROUND(AVG(actual_delivery_minutes) FILTER (WHERE actual_delivery_minutes IS NOT NULL)),
                'avg_rating', ROUND(AVG(customer_rating) FILTER (WHERE customer_rating IS NOT NULL), 1),
                'total_earnings', COALESCE(SUM(total) FILTER (WHERE delivery_status = 'delivered'), 0),
                'cancelled_count', COUNT(*) FILTER (WHERE delivery_status = 'cancelled'),
                'active_deliveries', COUNT(*) FILTER (WHERE delivery_status = 'delivering')
            )
            FROM delivery_history WHERE rider_id = v_rider_id
        )
    ) INTO result
    FROM delivery_history dh
    WHERE dh.rider_id = v_rider_id
      AND (p_status IS NULL OR dh.delivery_status = p_status)
      AND (p_start_date IS NULL OR dh.accepted_at::DATE >= p_start_date)
      AND (p_end_date IS NULL OR dh.accepted_at::DATE <= p_end_date)
    LIMIT p_limit
    OFFSET p_offset;
    
    -- Handle empty result (when no records found)
    IF result IS NULL THEN
        result := json_build_object(
            'success', true,
            'rider_id', v_rider_id,
            'history', '[]'::json,
            'total_count', 0,
            'has_more', false,
            'stats', json_build_object(
                'total_deliveries', 0,
                'total_today', 0,
                'total_this_week', 0,
                'total_this_month', 0,
                'avg_delivery_minutes', NULL,
                'avg_rating', NULL,
                'total_earnings', 0,
                'cancelled_count', 0,
                'active_deliveries', 0
            )
        );
    END IF;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_rider_delivery_history(p_rider_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_rider_delivery_history(p_rider_id uuid, p_status text, p_start_date date, p_end_date date, p_limit integer, p_offset integer) IS 'Returns paginated delivery history with stats for the specified or authenticated rider. Pass p_rider_id for explicit authentication.';


--
-- Name: get_sales_analytics(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sales_analytics(p_start_date date, p_end_date date, p_group_by text DEFAULT 'day'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    IF p_group_by = 'day' THEN
        SELECT json_agg(
            json_build_object(
                'date', date,
                'total_sales', total_sales,
                'order_count', order_count,
                'avg_order_value', avg_order_value
            )
            ORDER BY date
        ) INTO result
        FROM (
            SELECT 
                DATE(created_at) as date,
                SUM(total) as total_sales,
                COUNT(*) as order_count,
                AVG(total) as avg_order_value
            FROM orders
            WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
            AND status NOT IN ('cancelled')
            GROUP BY DATE(created_at)
        ) stats;
    ELSIF p_group_by = 'week' THEN
        SELECT json_agg(
            json_build_object(
                'week_start', week_start,
                'total_sales', total_sales,
                'order_count', order_count,
                'avg_order_value', avg_order_value
            )
            ORDER BY week_start
        ) INTO result
        FROM (
            SELECT 
                date_trunc('week', created_at)::DATE as week_start,
                SUM(total) as total_sales,
                COUNT(*) as order_count,
                AVG(total) as avg_order_value
            FROM orders
            WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
            AND status NOT IN ('cancelled')
            GROUP BY date_trunc('week', created_at)
        ) stats;
    ELSE
        SELECT json_agg(
            json_build_object(
                'month', month,
                'total_sales', total_sales,
                'order_count', order_count,
                'avg_order_value', avg_order_value
            )
            ORDER BY month
        ) INTO result
        FROM (
            SELECT 
                date_trunc('month', created_at)::DATE as month,
                SUM(total) as total_sales,
                COUNT(*) as order_count,
                AVG(total) as avg_order_value
            FROM orders
            WHERE DATE(created_at) BETWEEN p_start_date AND p_end_date
            AND status NOT IN ('cancelled')
            GROUP BY date_trunc('month', created_at)
        ) stats;
    END IF;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$;


--
-- Name: get_sales_by_date_range(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sales_by_date_range(p_start_date date, p_end_date date) RETURNS TABLE(date date, order_count bigint, total_revenue numeric, avg_order_value numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.created_at::DATE as date,
        COUNT(*)::BIGINT as order_count,
        COALESCE(SUM(o.total), 0) as total_revenue,
        COALESCE(AVG(o.total), 0) as avg_order_value
    FROM orders o
    WHERE o.created_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY o.created_at::DATE
    ORDER BY date DESC;
END;
$$;


--
-- Name: get_table_billing_info(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_table_billing_info(p_table_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_table RECORD;
    v_order RECORD;
    v_waiter RECORD;
BEGIN
    SELECT * INTO v_table FROM restaurant_tables WHERE id = p_table_id;
    
    IF v_table IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    IF v_table.status != 'occupied' THEN
        RETURN json_build_object('success', false, 'error', 'Table is not occupied');
    END IF;
    
    IF v_table.current_order_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No active order on this table');
    END IF;
    
    -- Get order
    SELECT * INTO v_order FROM orders WHERE id = v_table.current_order_id;
    
    -- Get waiter
    IF v_table.assigned_waiter_id IS NOT NULL THEN
        SELECT id, name, employee_id INTO v_waiter FROM employees WHERE id = v_table.assigned_waiter_id;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'table', json_build_object(
            'id', v_table.id,
            'table_number', v_table.table_number,
            'capacity', v_table.capacity,
            'current_customers', v_table.current_customers,
            'section', v_table.section,
            'floor', v_table.floor
        ),
        'order', json_build_object(
            'id', v_order.id,
            'order_number', v_order.order_number,
            'items', v_order.items,
            'items_count', jsonb_array_length(v_order.items),
            'subtotal', v_order.subtotal,
            'tax', v_order.tax,
            'total', v_order.total,
            'customer_name', v_order.customer_name,
            'customer_phone', v_order.customer_phone,
            'status', v_order.status,
            'created_at', v_order.created_at
        ),
        'waiter', CASE WHEN v_waiter.id IS NOT NULL THEN json_build_object(
            'id', v_waiter.id,
            'name', v_waiter.name,
            'employee_id', v_waiter.employee_id
        ) ELSE NULL END,
        'can_generate_bill', v_order.status IN ('confirmed', 'preparing', 'ready', 'delivered')
    );
END;
$$;


--
-- Name: FUNCTION get_table_billing_info(p_table_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_table_billing_info(p_table_id uuid) IS 'Returns table with order for billing';


--
-- Name: get_tables_for_waiter(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tables_for_waiter() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_waiter_id UUID;
    result JSON;
BEGIN
    v_waiter_id := get_employee_id();
    
    SELECT json_build_object(
        'success', true,
        'tables', COALESCE(json_agg(
            json_build_object(
                'id', t.id,
                'table_number', t.table_number,
                'capacity', t.capacity,
                'section', t.section,
                'floor', t.floor,
                'status', t.status,
                'current_customers', t.current_customers,
                'current_order_id', t.current_order_id,
                'assigned_waiter_id', t.assigned_waiter_id,
                'is_my_table', t.assigned_waiter_id = v_waiter_id,
                'assigned_waiter', CASE WHEN t.assigned_waiter_id IS NOT NULL THEN (
                    SELECT json_build_object('id', e.id, 'name', e.name)
                    FROM employees e WHERE e.id = t.assigned_waiter_id
                ) ELSE NULL END,
                'current_order', CASE WHEN t.current_order_id IS NOT NULL THEN (
                    SELECT json_build_object(
                        'id', o.id,
                        'order_number', o.order_number,
                        'status', o.status,
                        'total', o.total,
                        'items_count', jsonb_array_length(o.items),
                        'created_at', o.created_at
                    )
                    FROM orders o WHERE o.id = t.current_order_id
                ) ELSE NULL END,
                'reserved_by', t.reserved_by,
                'reservation_time', t.reservation_time,
                'updated_at', t.updated_at
            ) ORDER BY t.table_number
        ), '[]'::json),
        'my_tables_count', (
            SELECT COUNT(*) FROM restaurant_tables 
            WHERE assigned_waiter_id = v_waiter_id AND status = 'occupied'
        ),
        'available_count', (
            SELECT COUNT(*) FROM restaurant_tables WHERE status = 'available'
        ),
        'total_count', (SELECT COUNT(*) FROM restaurant_tables)
    ) INTO result
    FROM restaurant_tables t;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_tables_for_waiter(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_tables_for_waiter() IS 'Returns all tables with waiter-specific information';


--
-- Name: get_tables_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tables_status() RETURNS SETOF json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT json_build_object(
        'id', t.id,
        'table_number', t.table_number,
        'capacity', t.capacity,
        'status', t.status,
        'current_order_id', t.current_order_id,
        'assigned_waiter_id', t.assigned_waiter_id,
        'assigned_waiter_name', e.name,
        'section', t.section
    )
    FROM restaurant_tables t
    LEFT JOIN employees e ON t.assigned_waiter_id = e.id
    ORDER BY t.table_number;
END;
$$;


--
-- Name: get_today_attendance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_today_attendance() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    SELECT json_build_object(
        'success', true,
        'attendance', COALESCE(json_agg(
            json_build_object(
                'id', a.id,
                'employee_id', a.employee_id,
                'date', a.date,
                'check_in', a.check_in,
                'check_out', a.check_out,
                'status', a.status,
                'notes', a.notes,
                'employee', json_build_object(
                    'id', e.id,
                    'employee_id', e.employee_id,
                    'name', e.name,
                    'email', e.email,
                    'phone', e.phone,
                    'avatar_url', e.avatar_url,
                    'role', e.role,
                    'status', e.status,
                    'hired_date', e.hired_date
                )
            ) ORDER BY a.check_in DESC
        ), '[]'::json)
    ) INTO result
    FROM attendance a
    INNER JOIN employees e ON e.id = a.employee_id
    WHERE a.date = CURRENT_DATE;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_today_attendance(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_today_attendance() IS 'Returns all attendance for today - admin/manager only';


--
-- Name: get_top_selling_items(integer, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_selling_items(p_limit integer DEFAULT 10, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date) RETURNS TABLE(item_name text, item_type text, total_quantity bigint, total_revenue numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        item->>'name' as item_name,
        item->>'type' as item_type,
        SUM((item->>'quantity')::INT)::BIGINT as total_quantity,
        SUM((item->>'price')::DECIMAL * (item->>'quantity')::INT) as total_revenue
    FROM orders o,
    LATERAL jsonb_array_elements(o.items) as item
    WHERE 
        (p_start_date IS NULL OR o.created_at::DATE >= p_start_date)
        AND (p_end_date IS NULL OR o.created_at::DATE <= p_end_date)
    GROUP BY item->>'name', item->>'type'
    ORDER BY total_quantity DESC
    LIMIT p_limit;
END;
$$;


--
-- Name: get_unread_notification_count(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unread_notification_count(p_user_type text DEFAULT 'employee'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    count_val INTEGER;
BEGIN
    emp_id := get_employee_id();
    
    SELECT COUNT(*) INTO count_val
    FROM notifications
    WHERE user_id = emp_id
    AND user_type = p_user_type
    AND is_read = false;
    
    RETURN json_build_object('count', count_val);
END;
$$;


--
-- Name: get_unread_notifications_count(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unread_notifications_count(p_user_id uuid, p_user_type text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INT
        FROM notifications
        WHERE user_id = p_user_id
            AND user_type = p_user_type
            AND is_read = FALSE
    );
END;
$$;


--
-- Name: get_user_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_by_email(p_email text) RETURNS TABLE(id uuid, email text, name text, phone text, user_type text, role text, permissions jsonb, employee_id text, status text, is_2fa_enabled boolean, portal_enabled boolean, block_reason text, is_banned boolean, auth_user_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check employees first (includes admin)
    IF EXISTS (SELECT 1 FROM employees e WHERE LOWER(e.email) = LOWER(p_email)) THEN
        RETURN QUERY
        SELECT 
            e.id,
            e.email::TEXT,
            e.name::TEXT,
            e.phone::TEXT,
            CASE WHEN e.role = 'admin' THEN 'admin'::TEXT ELSE 'employee'::TEXT END AS user_type,
            e.role::TEXT,
            e.permissions,
            e.employee_id::TEXT,
            e.status::TEXT,
            e.is_2fa_enabled,
            COALESCE(e.portal_enabled, true) AS portal_enabled,
            e.block_reason::TEXT,
            (e.status = 'blocked')::boolean AS is_banned,
            e.auth_user_id
        FROM employees e
        WHERE LOWER(e.email) = LOWER(p_email);
        RETURN;
    END IF;

    -- Check customers
    RETURN QUERY
    SELECT 
        c.id,
        c.email::TEXT,
        c.name::TEXT,
        c.phone::TEXT,
        'customer'::TEXT AS user_type,
        NULL::TEXT AS role,
        NULL::JSONB AS permissions,
        NULL::TEXT AS employee_id,
        CASE WHEN c.is_verified THEN 'active'::TEXT ELSE 'pending'::TEXT END AS status,
        c.is_2fa_enabled,
        true AS portal_enabled,
        c.ban_reason::TEXT AS block_reason,
        COALESCE(c.is_banned, false) AS is_banned,
        c.auth_user_id
    FROM customers c
    WHERE LOWER(c.email) = LOWER(p_email);
END;
$$;


--
-- Name: get_user_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_profile(p_auth_user_id uuid) RETURNS TABLE(user_id uuid, user_type text, email text, name text, phone text, address text, role text, is_verified boolean, is_2fa_enabled boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check employees first
    IF EXISTS (SELECT 1 FROM employees WHERE auth_user_id = p_auth_user_id) THEN
        RETURN QUERY
        SELECT 
            e.id,
            CASE WHEN e.role = 'admin' THEN 'admin' ELSE 'employee' END,
            e.email,
            e.name,
            e.phone,
            NULL::TEXT,
            e.role::TEXT,
            TRUE,
            e.is_2fa_enabled,
            e.created_at
        FROM employees e
        WHERE e.auth_user_id = p_auth_user_id AND e.status = 'active';
        RETURN;
    END IF;

    -- Check customers
    RETURN QUERY
    SELECT 
        c.id,
        'customer'::TEXT,
        c.email,
        c.name,
        c.phone,
        c.address,
        NULL::TEXT,
        c.is_verified,
        c.is_2fa_enabled,
        c.created_at
    FROM customers c
    WHERE c.auth_user_id = p_auth_user_id;
END;
$$;


--
-- Name: get_waiter_dashboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_waiter_dashboard() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    result JSON;
BEGIN
    emp_id := get_employee_id();
    
    SELECT json_build_object(
        'today_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE waiter_id = emp_id
            AND DATE(created_at) = CURRENT_DATE
        ),
        'today_tips', (
            SELECT COALESCE(SUM(tip_amount), 0)
            FROM waiter_tips
            WHERE waiter_id = emp_id
            AND date = CURRENT_DATE
        ),
        'assigned_tables', (
            SELECT json_agg(
                json_build_object(
                    'id', t.id,
                    'table_number', t.table_number,
                    'status', t.status,
                    'current_customers', t.current_customers,
                    'current_order_id', t.current_order_id
                )
            )
            FROM restaurant_tables t
            WHERE t.assigned_waiter_id = emp_id
        ),
        'pending_orders', (
            SELECT json_agg(
                json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'table_number', o.table_number,
                    'status', o.status,
                    'items', o.items,
                    'total', o.total,
                    'can_cancel', o.can_cancel_until > NOW(),
                    'created_at', o.created_at
                )
                ORDER BY o.created_at DESC
            )
            FROM orders o
            WHERE o.waiter_id = emp_id
            AND o.status NOT IN ('delivered', 'cancelled')
        ),
        'employee', (
            SELECT json_build_object(
                'id', e.id,
                'name', e.name,
                'hired_date', e.hired_date,
                'total_tips', e.total_tips,
                'total_orders_taken', e.total_orders_taken
            )
            FROM employees e
            WHERE e.id = emp_id
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_waiter_dashboard_stats(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_waiter_dashboard_stats(p_employee_id uuid, p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT CURRENT_DATE) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'orders_count', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
    ), 0),
    'orders_today', COALESCE((
      SELECT COUNT(*)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) = CURRENT_DATE
    ), 0),
    'tips_total', COALESCE((
      SELECT SUM(tip_amount)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND tip_amount IS NOT NULL
    ), 0),
    'tips_today', COALESCE((
      SELECT SUM(tip_amount)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) = CURRENT_DATE
        AND tip_amount IS NOT NULL
    ), 0),
    'active_tables', COALESCE((
      SELECT COUNT(*)
      FROM restaurant_tables
      WHERE assigned_waiter_id = p_employee_id
        AND status = 'occupied'
    ), 0),
    'total_sales', COALESCE((
      SELECT SUM(total)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status NOT IN ('cancelled')
    ), 0),
    'avg_order_value', COALESCE((
      SELECT AVG(total)
      FROM orders
      WHERE employee_id = p_employee_id
        AND DATE(created_at) >= p_start_date
        AND DATE(created_at) <= p_end_date
        AND status NOT IN ('cancelled')
    ), 0),
    'date_range', json_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;


--
-- Name: get_waiter_order_history(date, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_waiter_order_history(p_date date DEFAULT NULL::date, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_waiter_id UUID;
    result JSON;
    total_count INT;
BEGIN
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Count total
    SELECT COUNT(*) INTO total_count
    FROM waiter_order_history h
    WHERE h.waiter_id = v_waiter_id
      AND (p_date IS NULL OR h.order_taken_at::DATE = p_date);
    
    -- Build result
    SELECT json_build_object(
        'success', true,
        'history', COALESCE(json_agg(
            json_build_object(
                'id', h.id,
                'order_id', h.order_id,
                'order_number', h.order_number,
                'invoice_number', h.invoice_number,
                'table_number', h.table_number,
                'customer_name', h.customer_name,
                'customer_phone', h.customer_phone,
                'is_registered_customer', h.is_registered_customer,
                'customer_count', h.customer_count,
                'items', h.items,
                'total_items', h.total_items,
                'subtotal', h.subtotal,
                'tax', h.tax,
                'total', h.total,
                'tip_amount', h.tip_amount,
                'payment_method', h.payment_method,
                'payment_status', h.payment_status,
                'order_status', h.order_status,
                'order_taken_at', h.order_taken_at,
                'order_completed_at', h.order_completed_at
            ) ORDER BY h.order_taken_at DESC
        ), '[]'::json),
        'total_count', total_count,
        'has_more', (p_offset + p_limit) < total_count,
        'stats', (
            SELECT json_build_object(
                'total_orders', COUNT(*),
                'orders_today', COUNT(*) FILTER (WHERE order_taken_at::DATE = CURRENT_DATE),
                'orders_this_week', COUNT(*) FILTER (WHERE order_taken_at >= CURRENT_DATE - INTERVAL '7 days'),
                'total_sales', COALESCE(SUM(total), 0),
                'sales_today', COALESCE(SUM(total) FILTER (WHERE order_taken_at::DATE = CURRENT_DATE), 0),
                'total_tips', COALESCE(SUM(tip_amount), 0),
                'tips_today', COALESCE(SUM(tip_amount) FILTER (WHERE order_taken_at::DATE = CURRENT_DATE), 0),
                'avg_order_value', ROUND(AVG(total), 2),
                'total_customers', COALESCE(SUM(customer_count), 0),
                'customers_today', COALESCE(SUM(customer_count) FILTER (WHERE order_taken_at::DATE = CURRENT_DATE), 0)
            )
            FROM waiter_order_history WHERE waiter_id = v_waiter_id
        )
    ) INTO result
    FROM waiter_order_history h
    WHERE h.waiter_id = v_waiter_id
      AND (p_date IS NULL OR h.order_taken_at::DATE = p_date)
    LIMIT p_limit
    OFFSET p_offset;
    
    RETURN result;
END;
$$;


--
-- Name: FUNCTION get_waiter_order_history(p_date date, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_waiter_order_history(p_date date, p_limit integer, p_offset integer) IS 'Returns paginated order history with statistics for waiter';


--
-- Name: get_website_settings_internal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_website_settings_internal() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT content INTO result
    FROM website_content
    WHERE key = 'settings'
    LIMIT 1;
    
    RETURN json_build_object(
        'success', true,
        'settings', result
    );
END;
$$;


--
-- Name: hard_delete_inventory_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hard_delete_inventory_item(p_item_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Only admins can permanently delete items');
    END IF;
    
    -- Delete transactions first
    DELETE FROM inventory_transactions WHERE inventory_id = p_item_id;
    DELETE FROM inventory_alerts WHERE inventory_id = p_item_id;
    DELETE FROM inventory WHERE id = p_item_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: has_role(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(allowed_roles text[]) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() 
            AND role::TEXT = ANY(allowed_roles) 
            AND status = 'active'
    );
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() 
        AND status = 'active'
        AND role = 'admin'
    );
END;
$$;


--
-- Name: is_employee(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_employee() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() AND status = 'active'
    );
END;
$$;


--
-- Name: is_favorite(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_favorite(p_customer_id uuid, p_item_id text, p_item_type text DEFAULT 'menu_item'::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: is_manager_or_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_manager_or_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('admin', 'manager')
    );
END;
$$;


--
-- Name: link_google_auth_to_customer(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_google_auth_to_customer(p_customer_id uuid, p_auth_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update customer with auth_user_id if not already linked to different auth
  UPDATE customers
  SET auth_user_id = p_auth_user_id,
      updated_at = now()
  WHERE id = p_customer_id
    AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id);
  
  RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION link_google_auth_to_customer(p_customer_id uuid, p_auth_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.link_google_auth_to_customer(p_customer_id uuid, p_auth_user_id uuid) IS 'Links Google auth to an existing customer account.';


--
-- Name: link_google_auth_to_employee(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_google_auth_to_employee(p_employee_id uuid, p_auth_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_employee_status text;
  v_portal_enabled boolean;
BEGIN
  -- Check employee status and portal access
  SELECT status, COALESCE(portal_enabled, true)
  INTO v_employee_status, v_portal_enabled
  FROM employees
  WHERE id = p_employee_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;
  
  -- Don't allow linking for inactive employees
  IF v_employee_status != 'active' THEN
    RAISE EXCEPTION 'Employee account is not active. Please activate your account first.';
  END IF;
  
  -- Don't allow linking for blocked employees
  IF v_portal_enabled = false THEN
    RAISE EXCEPTION 'Your portal access has been disabled. Please contact administrator.';
  END IF;
  
  -- Update employee with auth_user_id if not already linked to different auth
  UPDATE employees
  SET auth_user_id = p_auth_user_id,
      updated_at = now()
  WHERE id = p_employee_id
    AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id);
  
  RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION link_google_auth_to_employee(p_employee_id uuid, p_auth_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.link_google_auth_to_employee(p_employee_id uuid, p_auth_user_id uuid) IS 'Links Google auth to an existing active employee account.';


--
-- Name: log_admin_action(text, text, uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_admin_action(p_action text, p_entity_type text, p_entity_id uuid, p_old_data jsonb DEFAULT NULL::jsonb, p_new_data jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
    v_log_id UUID;
BEGIN
    -- Get employee ID from auth
    SELECT id INTO v_user_id
    FROM employees
    WHERE auth_user_id = auth.uid();
    
    -- Create audit log
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (v_user_id, p_action, p_entity_type, p_entity_id, p_old_data, p_new_data)
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


--
-- Name: log_audit_action(text, text, uuid, jsonb, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_action(p_action text, p_table_name text, p_record_id uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    INSERT INTO audit_logs (
        action, table_name, record_id, old_values, new_values,
        performed_by, ip_address, user_agent
    ) VALUES (
        p_action, p_table_name, p_record_id, p_old_values, p_new_values,
        emp_id, p_ip_address, p_user_agent
    );
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: log_password_reset_completion(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_password_reset_completion(p_email text, p_ip_address text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Mark all OTPs for this email as used/expired
  UPDATE public.password_reset_otps
  SET is_verified = false
  WHERE email = p_email;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Password reset completed successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to log password reset completion'
    );
END;
$$;


--
-- Name: FUNCTION log_password_reset_completion(p_email text, p_ip_address text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_password_reset_completion(p_email text, p_ip_address text) IS 'Logs successful password reset completion';


--
-- Name: lookup_customer(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lookup_customer(p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_name text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_customer RECORD;
BEGIN
    -- Search by phone first, then email, then name
    SELECT * INTO v_customer FROM customers
    WHERE 
        (p_phone IS NOT NULL AND phone = p_phone) OR
        (p_email IS NOT NULL AND email = p_email) OR
        (p_name IS NOT NULL AND LOWER(name) = LOWER(p_name))
    ORDER BY 
        CASE WHEN phone = p_phone THEN 0 ELSE 1 END,
        CASE WHEN email = p_email THEN 0 ELSE 1 END
    LIMIT 1;
    
    IF v_customer IS NULL THEN
        RETURN json_build_object(
            'found', false,
            'message', 'Customer not found in system'
        );
    END IF;
    
    RETURN json_build_object(
        'found', true,
        'customer', json_build_object(
            'id', v_customer.id,
            'name', v_customer.name,
            'phone', v_customer.phone,
            'email', v_customer.email,
            'address', v_customer.address,
            'loyalty_points', v_customer.loyalty_points,
            'total_orders', v_customer.total_orders,
            'is_verified', v_customer.is_verified,
            'created_at', v_customer.created_at
        )
    );
END;
$$;


--
-- Name: FUNCTION lookup_customer(p_phone text, p_email text, p_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.lookup_customer(p_phone text, p_email text, p_name text) IS 'Searches for registered customer by phone/email/name';


--
-- Name: manage_menu_category(text, uuid, text, text, text, text, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manage_menu_category(p_action text, p_category_id uuid DEFAULT NULL::uuid, p_name text DEFAULT NULL::text, p_slug text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_display_order integer DEFAULT NULL::integer, p_is_visible boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: FUNCTION manage_menu_category(p_action text, p_category_id uuid, p_name text, p_slug text, p_description text, p_image_url text, p_display_order integer, p_is_visible boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.manage_menu_category(p_action text, p_category_id uuid, p_name text, p_slug text, p_description text, p_image_url text, p_display_order integer, p_is_visible boolean) IS 'Unified CRUD for categories: create, update, delete, toggle';


--
-- Name: mark_all_notifications_read(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_all_notifications_read(p_user_type text DEFAULT 'employee'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    UPDATE notifications
    SET is_read = true
    WHERE user_id = emp_id
    AND user_type = p_user_type
    AND is_read = false;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: mark_attendance_with_code(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_attendance_with_code(p_code character varying) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    emp_status VARCHAR;
    code_record RECORD;
    attendance_record RECORD;
    new_status VARCHAR;
    action_type VARCHAR;
    message TEXT;
BEGIN
    emp_id := get_employee_id();
    
    IF emp_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    
    -- Check employee status
    SELECT status INTO emp_status FROM employees WHERE id = emp_id;
    IF emp_status != 'active' THEN
        RETURN json_build_object('success', false, 'message', 'Your account is not active');
    END IF;
    
    -- Validate code with stricter checks
    SELECT * INTO code_record
    FROM attendance_codes
    WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND valid_for_date = CURRENT_DATE
    AND CURRENT_TIME BETWEEN valid_from AND valid_until;
    
    IF code_record IS NULL THEN
        -- Log failed attempt (optional - for security monitoring)
        RETURN json_build_object('success', false, 'message', 'Invalid or expired code');
    END IF;
    
    -- Check existing attendance
    SELECT * INTO attendance_record
    FROM attendance
    WHERE employee_id = emp_id
    AND date = CURRENT_DATE;
    
    IF attendance_record IS NOT NULL THEN
        -- Already checked in - try check out
        IF attendance_record.check_out IS NOT NULL THEN
            RETURN json_build_object(
                'success', false, 
                'message', 'You have already checked out today'
            );
        END IF;
        
        -- Perform check out
        UPDATE attendance
        SET check_out = NOW(),
            updated_at = NOW()
        WHERE id = attendance_record.id
        RETURNING * INTO attendance_record;
        
        action_type := 'check_out';
        message := 'Checked out successfully at ' || to_char(NOW(), 'HH12:MI AM');
    ELSE
        -- New check in
        new_status := CASE 
            WHEN CURRENT_TIME > '09:30:00'::TIME THEN 'late'
            ELSE 'present'
        END;
        
        INSERT INTO attendance (
            employee_id, 
            date, 
            check_in, 
            status,
            created_at,
            updated_at
        )
        VALUES (
            emp_id,
            CURRENT_DATE,
            NOW(),
            new_status,
            NOW(),
            NOW()
        )
        RETURNING * INTO attendance_record;
        
        action_type := 'check_in';
        message := CASE 
            WHEN new_status = 'late' 
            THEN 'Checked in as LATE at ' || to_char(NOW(), 'HH12:MI AM')
            ELSE 'Checked in successfully at ' || to_char(NOW(), 'HH12:MI AM')
        END;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'action', action_type,
        'message', message,
        'attendance', json_build_object(
            'id', attendance_record.id,
            'date', attendance_record.date,
            'check_in', attendance_record.check_in,
            'check_out', attendance_record.check_out,
            'status', attendance_record.status
        )
    );
END;
$$;


--
-- Name: FUNCTION mark_attendance_with_code(p_code character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mark_attendance_with_code(p_code character varying) IS 'Mark attendance with code - secure with validation';


--
-- Name: mark_inventory_alert_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_inventory_alert_read(p_alert_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE inventory_alerts SET is_read = true WHERE id = p_alert_id;
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: mark_invoice_printed(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_invoice_printed(p_invoice_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE invoices
    SET printed = true,
        printed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invoice not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Invoice marked as printed');
END;
$$;


--
-- Name: FUNCTION mark_invoice_printed(p_invoice_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mark_invoice_printed(p_invoice_id uuid) IS 'Marks invoice as printed';


--
-- Name: mark_notification_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notification_read(p_notification_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE id = p_notification_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: mark_notifications_read(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notifications_read(p_notification_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE id = ANY(p_notification_ids)
    AND user_id = get_employee_id();
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: mark_notifications_read(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notifications_read(p_user_id uuid, p_notification_ids uuid[] DEFAULT NULL::uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INT;
BEGIN
    IF p_notification_ids IS NULL THEN
        -- Mark all as read
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = p_user_id AND is_read = FALSE;
    ELSE
        -- Mark specific ones
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = p_user_id AND id = ANY(p_notification_ids);
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


--
-- Name: mark_review_helpful(uuid, uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_review_helpful(p_review_id uuid, p_customer_id uuid DEFAULT NULL::uuid, p_ip_address character varying DEFAULT NULL::character varying) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: notify_new_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_notification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM pg_notify(
        'new_notification',
        json_build_object(
            'id', NEW.id,
            'user_id', NEW.user_id,
            'user_type', NEW.user_type,
            'title', NEW.title,
            'type', NEW.type
        )::text
    );
    RETURN NEW;
END;
$$;


--
-- Name: notify_order_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_order_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Trigger realtime event
        PERFORM pg_notify(
            'order_status_changed',
            json_build_object(
                'order_id', NEW.id,
                'customer_id', NEW.customer_id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'updated_at', NEW.updated_at
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: preview_promo_code(text, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_promo_code(p_code text, p_customer_id uuid, p_order_amount numeric) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_promo RECORD;
    v_discount DECIMAL := 0;
BEGIN
    -- Find the promo code (no lock needed for preview)
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code);

    -- Check if code exists
    IF v_promo IS NULL THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Invalid promo code'
        );
    END IF;

    -- Check if code is active
    IF NOT v_promo.is_active THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code is no longer active'
        );
    END IF;

    -- Check customer-specific codes belong to the right customer
    IF v_promo.customer_id IS NOT NULL AND v_promo.customer_id != p_customer_id THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code is not available for your account'
        );
    END IF;

    -- Check validity dates
    IF v_promo.valid_from IS NOT NULL AND v_promo.valid_from > NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code is not yet active'
        );
    END IF;

    IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code has expired'
        );
    END IF;

    -- Check usage limit
    IF v_promo.usage_limit IS NOT NULL AND v_promo.current_usage >= v_promo.usage_limit THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'This promo code has already been used'
        );
    END IF;

    -- Check minimum order amount
    IF v_promo.min_order_amount IS NOT NULL AND p_order_amount < v_promo.min_order_amount THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Minimum order of Rs. ' || v_promo.min_order_amount || ' required',
            'min_order_amount', v_promo.min_order_amount
        );
    END IF;

    -- Calculate discount
    IF v_promo.promo_type = 'percentage' THEN
        v_discount := ROUND((p_order_amount * v_promo.value / 100)::DECIMAL, 2);
        IF v_promo.max_discount IS NOT NULL AND v_discount > v_promo.max_discount THEN
            v_discount := v_promo.max_discount;
        END IF;
    ELSIF v_promo.promo_type = 'fixed' THEN
        v_discount := LEAST(v_promo.value, p_order_amount);
    ELSE
        v_discount := COALESCE(v_promo.value, 0);
    END IF;

    -- Return preview result
    RETURN json_build_object(
        'valid', true,
        'promo', json_build_object(
            'id', v_promo.id,
            'code', v_promo.code,
            'name', v_promo.name,
            'description', v_promo.description,
            'promo_type', v_promo.promo_type::TEXT,
            'value', v_promo.value,
            'max_discount', v_promo.max_discount,
            'is_customer_reward', v_promo.customer_id IS NOT NULL
        ),
        'discount_amount', v_discount,
        'final_amount', GREATEST(0, p_order_amount - v_discount),
        'message', CASE 
            WHEN v_promo.promo_type = 'percentage' THEN 
                'You''ll save ' || v_promo.value || '%' || 
                CASE WHEN v_promo.max_discount IS NOT NULL THEN ' (up to Rs. ' || v_promo.max_discount || ')' ELSE '' END
            WHEN v_promo.promo_type = 'fixed' THEN 'You''ll save Rs. ' || v_discount
            ELSE v_promo.name || ' will be applied'
        END
    );
END;
$$;


--
-- Name: record_payment_proof(uuid, uuid, text, public.payment_method); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_payment_proof(p_order_id uuid, p_customer_id uuid, p_proof_url text, p_payment_method public.payment_method) RETURNS TABLE(success boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Verify order belongs to customer
    IF NOT EXISTS (
        SELECT 1 FROM orders 
        WHERE id = p_order_id AND customer_id = p_customer_id
    ) THEN
        RETURN QUERY SELECT FALSE, 'Order not found';
        RETURN;
    END IF;

    -- Update order with payment proof
    UPDATE orders
    SET 
        payment_status = 'proof_uploaded',
        payment_proof_url = p_proof_url,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Add to status history
    INSERT INTO order_status_history (order_id, status, notes)
    VALUES (p_order_id, (SELECT status FROM orders WHERE id = p_order_id), 
            'Payment proof uploaded for verification');

    -- Notify admin/billing staff
    INSERT INTO notifications (user_type, user_id, title, message, type, data)
    SELECT 
        'employee', id,
        'Payment Proof Uploaded',
        'A customer has uploaded payment proof for verification',
        'payment',
        jsonb_build_object('order_id', p_order_id, 'proof_url', p_proof_url)
    FROM employees
    WHERE role IN ('admin', 'cashier') AND status = 'active';

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;


--
-- Name: record_promo_usage(uuid, uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_promo_usage(p_customer_id uuid, p_deal_id uuid, p_order_id uuid, p_discount numeric) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO promo_code_usage (
        customer_id,
        deal_id,
        order_id,
        discount_applied,
        created_at
    ) VALUES (
        p_customer_id,
        p_deal_id,
        p_order_id,
        p_discount,
        NOW()
    );
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


--
-- Name: FUNCTION record_promo_usage(p_customer_id uuid, p_deal_id uuid, p_order_id uuid, p_discount numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_promo_usage(p_customer_id uuid, p_deal_id uuid, p_order_id uuid, p_discount numeric) IS 'Records promo code usage for an order';


--
-- Name: register_customer(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_customer(p_auth_user_id uuid, p_email text, p_name text, p_phone text, p_address text DEFAULT NULL::text) RETURNS TABLE(success boolean, customer_id uuid, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    -- Check if email exists
    IF EXISTS (SELECT 1 FROM customers WHERE email = LOWER(p_email)) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Email already registered';
        RETURN;
    END IF;

    -- Check if phone exists
    IF EXISTS (SELECT 1 FROM customers WHERE phone = p_phone) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Phone number already registered';
        RETURN;
    END IF;

    -- Check if already an employee/admin
    IF EXISTS (SELECT 1 FROM employees WHERE email = LOWER(p_email)) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Email belongs to staff account';
        RETURN;
    END IF;

    -- Create customer
    INSERT INTO customers (auth_user_id, email, name, phone, address, is_verified)
    VALUES (p_auth_user_id, LOWER(p_email), p_name, p_phone, p_address, TRUE)
    RETURNING id INTO v_customer_id;

    -- Create welcome notification
    INSERT INTO notifications (user_type, user_id, title, message, type)
    VALUES ('customer', v_customer_id, 'Welcome to Zoiro Broast Hub! ðŸ—', 
            'Your account has been created successfully. Start ordering delicious food now!', 'system');

    RETURN QUERY SELECT TRUE, v_customer_id, NULL::TEXT;
END;
$$;


--
-- Name: release_table(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_table(p_table_id uuid, p_tip_amount numeric DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_waiter_id UUID;
    v_table_record RECORD;
    v_order_id UUID;
BEGIN
    v_waiter_id := get_employee_id();
    
    IF v_waiter_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get table
    SELECT * INTO v_table_record FROM restaurant_tables 
    WHERE id = p_table_id FOR UPDATE;
    
    IF v_table_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
    END IF;
    
    -- Validate ownership
    IF v_table_record.assigned_waiter_id != v_waiter_id THEN
        -- Check if manager/admin
        IF NOT EXISTS (SELECT 1 FROM employees WHERE id = v_waiter_id AND role IN ('admin', 'manager')) THEN
            RETURN json_build_object('success', false, 'error', 'Not authorized to release this table');
        END IF;
    END IF;
    
    v_order_id := v_table_record.current_order_id;
    
    -- Update order to delivered/completed
    IF v_order_id IS NOT NULL THEN
        UPDATE orders
        SET 
            status = 'delivered',
            payment_status = 'paid',
            updated_at = NOW()
        WHERE id = v_order_id;
        
        -- Add to order status history
        INSERT INTO order_status_history (order_id, status, changed_by, notes)
        VALUES (v_order_id, 'delivered'::order_status, v_waiter_id, 'Table released, bill paid');
        
        -- Update waiter history
        UPDATE waiter_order_history
        SET 
            order_status = 'completed',
            order_completed_at = NOW(),
            payment_status = 'paid',
            tip_amount = p_tip_amount,
            updated_at = NOW()
        WHERE order_id = v_order_id AND waiter_id = v_waiter_id;
    END IF;
    
    -- Update table_history if exists
    BEGIN
        UPDATE table_history
        SET 
            closed_at = NOW(),
            total_bill = (SELECT total FROM orders WHERE id = v_order_id),
            tip_amount = p_tip_amount
        WHERE table_id = p_table_id AND order_id = v_order_id;
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;
    
    -- Release the table
    UPDATE restaurant_tables
    SET 
        status = 'cleaning',
        current_order_id = NULL,
        current_customers = 0,
        assigned_waiter_id = NULL,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    -- Update waiter tips
    IF p_tip_amount > 0 THEN
        UPDATE employees
        SET 
            total_tips = COALESCE(total_tips, 0) + p_tip_amount,
            updated_at = NOW()
        WHERE id = v_waiter_id;
        
        -- Insert into waiter_tips if exists
        BEGIN
            INSERT INTO waiter_tips (waiter_id, order_id, tip_amount, date)
            VALUES (v_waiter_id, v_order_id, p_tip_amount, CURRENT_DATE)
            ON CONFLICT (waiter_id, date) DO UPDATE
            SET tip_amount = waiter_tips.tip_amount + p_tip_amount;
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'table_id', p_table_id,
        'table_number', v_table_record.table_number,
        'order_id', v_order_id,
        'tip_amount', p_tip_amount,
        'new_status', 'cleaning',
        'message', 'Table released successfully'
    );
END;
$$;


--
-- Name: FUNCTION release_table(p_table_id uuid, p_tip_amount numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.release_table(p_table_id uuid, p_tip_amount numeric) IS 'Releases table after billing, records tips';


--
-- Name: remove_employee_document(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_employee_document(p_employee_id uuid, p_document_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_file_url TEXT;
BEGIN
  -- Get document file URL for cleanup
  SELECT file_url INTO v_file_url
  FROM employee_documents
  WHERE id = p_document_id AND employee_id = p_employee_id;

  IF v_file_url IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document not found');
  END IF;

  DELETE FROM employee_documents WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'success', true,
    'file_url', v_file_url,  -- Return URL so frontend can delete from storage
    'message', 'Document removed successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: remove_employee_document_v2(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_employee_document_v2(p_employee_id uuid, p_document_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_file_url TEXT;
    v_doc_type TEXT;
BEGIN
    SELECT file_url, document_type INTO v_file_url, v_doc_type
    FROM employee_documents
    WHERE id = p_document_id AND employee_id = p_employee_id;

    IF v_doc_type IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Document not found');
    END IF;

    DELETE FROM employee_documents WHERE id = p_document_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'file_url_to_delete', v_file_url,
        'document_type', v_doc_type,
        'message', 'Document removed successfully'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;


--
-- Name: reorder_menu_categories(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_menu_categories(p_category_ids uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: FUNCTION reorder_menu_categories(p_category_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.reorder_menu_categories(p_category_ids uuid[]) IS 'Reorder categories by providing array of IDs in desired order';


--
-- Name: reply_to_review(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reply_to_review(p_review_id uuid, p_reply text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE reviews
    SET 
        admin_reply = p_reply, 
        replied_at = NOW(),
        updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: reply_to_review_advanced(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reply_to_review_advanced(p_review_id uuid, p_reply text, p_employee_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: reply_to_review_by_employee(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reply_to_review_by_employee(p_review_id uuid, p_reply text, p_employee_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Check if employee exists and is manager or admin
    SELECT role INTO v_role 
    FROM employees 
    WHERE id = p_employee_id 
    AND status = 'active';
    
    IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    UPDATE reviews
    SET admin_reply = p_reply, 
        replied_at = NOW(), 
        replied_by = p_employee_id,
        updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true, 'replied_at', NOW());
END;
$$;


--
-- Name: request_table_exchange(uuid, uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_table_exchange(p_table_id uuid, p_to_waiter_id uuid, p_exchange_type text, p_swap_table_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    INSERT INTO table_exchange_requests (
        from_waiter_id, to_waiter_id, table_id,
        exchange_type, swap_table_id, reason
    ) VALUES (
        emp_id, p_to_waiter_id, p_table_id,
        p_exchange_type, p_swap_table_id, p_reason
    );
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: reset_customer_password(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_customer_password(p_email text, p_new_password text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_customer RECORD;
  v_auth_user RECORD;
  v_auth_user_id UUID;
  v_error_message TEXT;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Validate input
  IF p_email IS NULL OR p_email = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email is required'
    );
  END IF;
  
  IF p_new_password IS NULL OR LENGTH(p_new_password) < 8 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Password must be at least 8 characters'
    );
  END IF;
  
  -- Get user details (check customers first, then employees)
  SELECT id, auth_user_id, name, email
  INTO v_customer
  FROM public.customers
  WHERE email = p_email;
  
  -- If not found in customers, check employees
  IF NOT FOUND THEN
    SELECT id, auth_user_id, name, email
    INTO v_customer
    FROM public.employees
    WHERE email = p_email;
  END IF;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Account not found with this email'
    );
  END IF;
  
  -- Check if customer has auth_user_id
  IF v_customer.auth_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer account not properly configured. Please contact support.'
    );
  END IF;
  
  -- Cast auth_user_id to UUID
  BEGIN
    v_auth_user_id := v_customer.auth_user_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Invalid auth user ID');
  END;
  
  -- Verify the auth user exists and is valid
  SELECT id, email, email_confirmed_at, banned_until, deleted_at
  INTO v_auth_user
  FROM auth.users
  WHERE id::text = v_auth_user_id::text;
  
  -- Check if auth user exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Authentication account not found. Please contact support.',
      'code', 'AUTH_USER_NOT_FOUND'
    );
  END IF;
  
  -- Check if user is deleted
  IF v_auth_user.deleted_at IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This account has been deleted. Please contact support.',
      'code', 'AUTH_USER_DELETED'
    );
  END IF;
  
  -- Check if user is banned
  IF v_auth_user.banned_until IS NOT NULL AND v_auth_user.banned_until > NOW() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This account has been suspended. Please contact support.',
      'code', 'AUTH_USER_BANNED'
    );
  END IF;
  
  -- Return success with user info for the API to use
  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer.id,
    'auth_user_id', v_customer.auth_user_id,
    'email', v_customer.email,
    'name', v_customer.name,
    'auth_email', v_auth_user.email,
    'email_confirmed', v_auth_user.email_confirmed_at IS NOT NULL
  );
  
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to process password reset: ' || v_error_message
    );
END;
$$;


--
-- Name: FUNCTION reset_customer_password(p_email text, p_new_password text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.reset_customer_password(p_email text, p_new_password text) IS 'Validates customer and auth user, prepares for password reset';


--
-- Name: resolve_employee_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_employee_id(p_employee_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF p_employee_id IS NOT NULL THEN RETURN p_employee_id; END IF;
  RETURN get_employee_id();
END;
$$;


--
-- Name: resolve_inventory_alert(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_inventory_alert(p_alert_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    UPDATE inventory_alerts 
    SET is_resolved = true, resolved_by = emp_id, resolved_at = NOW()
    WHERE id = p_alert_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: respond_table_exchange(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_table_exchange(p_request_id uuid, p_accept boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    request_record RECORD;
BEGIN
    emp_id := get_employee_id();
    
    SELECT * INTO request_record
    FROM table_exchange_requests
    WHERE id = p_request_id;
    
    IF request_record.to_waiter_id != emp_id THEN
        RETURN json_build_object('success', false, 'error', 'Not your request');
    END IF;
    
    -- Update request
    UPDATE table_exchange_requests
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
        responded_at = NOW()
    WHERE id = p_request_id;
    
    -- If accepted, do the exchange
    IF p_accept THEN
        IF request_record.exchange_type = 'one_way' THEN
            UPDATE restaurant_tables
            SET assigned_waiter_id = request_record.to_waiter_id,
                updated_at = NOW()
            WHERE id = request_record.table_id;
        ELSE
            -- Swap tables
            UPDATE restaurant_tables
            SET assigned_waiter_id = request_record.to_waiter_id,
                updated_at = NOW()
            WHERE id = request_record.table_id;
            
            UPDATE restaurant_tables
            SET assigned_waiter_id = request_record.from_waiter_id,
                updated_at = NOW()
            WHERE id = request_record.swap_table_id;
        END IF;
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: revert_promo_code_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_promo_code_usage(p_promo_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_promo RECORD;
BEGIN
    SELECT * INTO v_promo FROM promo_codes WHERE id = p_promo_id FOR UPDATE;
    
    IF v_promo IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Promo code not found');
    END IF;

    -- Decrement usage (but not below 0)
    UPDATE promo_codes
    SET 
        current_usage = GREATEST(0, COALESCE(current_usage, 1) - 1),
        is_active = true,  -- Reactivate if it was deactivated due to usage limit
        updated_at = NOW()
    WHERE id = p_promo_id;

    RETURN json_build_object('success', true, 'message', 'Promo code usage reverted');
END;
$$;


--
-- Name: review_leave_request(uuid, character varying, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_leave_request(p_request_id uuid, p_status character varying, p_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  reviewer_id UUID;
  request_record RECORD;
  emp_record RECORD;
BEGIN
  IF NOT is_manager_or_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  reviewer_id := get_employee_id();
  
  -- Validate status
  IF p_status NOT IN ('approved', 'rejected') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid status. Use approved or rejected');
  END IF;
  
  -- Get the request
  SELECT * INTO request_record FROM leave_requests WHERE id = p_request_id;
  
  IF request_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave request not found');
  END IF;
  
  IF request_record.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'This request has already been reviewed');
  END IF;
  
  -- Update the request
  UPDATE leave_requests
  SET status = p_status,
      reviewed_by = reviewer_id,
      reviewed_at = NOW(),
      review_notes = p_notes,
      updated_at = NOW()
  WHERE id = p_request_id;
  
  -- If approved, update leave balance
  IF p_status = 'approved' AND request_record.leave_type IN ('annual', 'sick', 'casual') THEN
    UPDATE leave_balances
    SET 
      annual_used = CASE WHEN request_record.leave_type = 'annual' THEN annual_used + request_record.total_days ELSE annual_used END,
      sick_used = CASE WHEN request_record.leave_type = 'sick' THEN sick_used + request_record.total_days ELSE sick_used END,
      casual_used = CASE WHEN request_record.leave_type = 'casual' THEN casual_used + request_record.total_days ELSE casual_used END,
      updated_at = NOW()
    WHERE employee_id = request_record.employee_id;
    
    -- Also mark attendance as on_leave for approved dates
    INSERT INTO attendance (employee_id, date, status, notes)
    SELECT 
      request_record.employee_id,
      d::date,
      'on_leave',
      format('%s leave', request_record.leave_type)
    FROM generate_series(request_record.start_date, request_record.end_date, '1 day'::interval) d
    ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_leave', notes = EXCLUDED.notes;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', format('Leave request %s successfully', p_status)
  );
END;
$$;


--
-- Name: FUNCTION review_leave_request(p_request_id uuid, p_status character varying, p_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.review_leave_request(p_request_id uuid, p_status character varying, p_notes text) IS 'Approve or reject a leave request - admin/manager only';


--
-- Name: review_leave_request(uuid, uuid, character varying, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_leave_request(p_caller_id uuid, p_request_id uuid, p_status character varying, p_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  reviewer_id UUID;
  request_record RECORD;
BEGIN
  reviewer_id := resolve_employee_id(p_caller_id);
  IF NOT check_manager_or_admin(reviewer_id) THEN RETURN json_build_object('success', false, 'error', 'Not authorized'); END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN RETURN json_build_object('success', false, 'error', 'Invalid status'); END IF;
  
  SELECT * INTO request_record FROM leave_requests WHERE id = p_request_id;
  IF request_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'Leave request not found'); END IF;
  IF request_record.status != 'pending' THEN RETURN json_build_object('success', false, 'error', 'Already reviewed'); END IF;
  
  UPDATE leave_requests SET status = p_status, reviewed_by = reviewer_id, reviewed_at = NOW(), review_notes = p_notes, updated_at = NOW()
  WHERE id = p_request_id;
  
  IF p_status = 'approved' AND request_record.leave_type IN ('annual', 'sick', 'casual') THEN
    UPDATE leave_balances SET
      annual_used = CASE WHEN request_record.leave_type = 'annual' THEN annual_used + request_record.total_days ELSE annual_used END,
      sick_used = CASE WHEN request_record.leave_type = 'sick' THEN sick_used + request_record.total_days ELSE sick_used END,
      casual_used = CASE WHEN request_record.leave_type = 'casual' THEN casual_used + request_record.total_days ELSE casual_used END
    WHERE employee_id = request_record.employee_id;
    
    INSERT INTO attendance (employee_id, date, status, notes)
    SELECT request_record.employee_id, d::date, 'on_leave', format('%s leave', request_record.leave_type)
    FROM generate_series(request_record.start_date, request_record.end_date, '1 day'::interval) d
    ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_leave', notes = EXCLUDED.notes;
  END IF;
  
  RETURN json_build_object('success', true, 'message', format('Leave request %s', p_status));
END;
$$;


--
-- Name: revoke_attendance_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_attendance_code() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Check authorization
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Delete all codes for today (active and inactive)
    DELETE FROM attendance_codes
    WHERE valid_for_date = CURRENT_DATE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'deleted_count', deleted_count,
        'message', 'Attendance code revoked and deleted'
    );
END;
$$;


--
-- Name: scheduled_cleanup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.scheduled_cleanup() RETURNS TABLE(otps_deleted integer, old_notifications_deleted integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_otps INTEGER;
    v_notifications INTEGER;
BEGIN
    -- Cleanup expired OTPs
    DELETE FROM otp_codes WHERE expires_at < NOW() OR is_used = TRUE;
    GET DIAGNOSTICS v_otps = ROW_COUNT;
    
    -- Cleanup old read notifications (older than 30 days)
    DELETE FROM notifications 
    WHERE is_read = TRUE AND created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_notifications = ROW_COUNT;
    
    RETURN QUERY SELECT v_otps, v_notifications;
END;
$$;


--
-- Name: search_customer_for_order(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_customer_for_order(p_search text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
    v_search_clean TEXT;
BEGIN
    -- Clean search input
    v_search_clean := TRIM(p_search);
    
    -- Return empty if search too short
    IF LENGTH(v_search_clean) < 2 THEN
        RETURN json_build_object(
            'success', true,
            'exact_match', false,
            'customers', '[]'::json
        );
    END IF;

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
            -- Prioritize exact matches
            CASE 
                WHEN c.phone = v_search_clean THEN 0
                WHEN c.email = v_search_clean THEN 1
                WHEN LOWER(c.name) = LOWER(v_search_clean) THEN 2
                WHEN c.phone LIKE v_search_clean || '%' THEN 3
                ELSE 4 
            END as match_rank
        FROM customers c
        WHERE 
            -- Search by phone (partial match)
            c.phone ILIKE '%' || v_search_clean || '%'
            -- Search by name (partial match)
            OR c.name ILIKE '%' || v_search_clean || '%'
            -- Search by email (partial match)
            OR c.email ILIKE '%' || v_search_clean || '%'
        ORDER BY match_rank, c.name
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
            cs.match_rank,
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
        'exact_match', COALESCE((SELECT bool_or(match_rank <= 2) FROM customer_stats), false),
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
                ORDER BY match_rank, name
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
$$;


--
-- Name: FUNCTION search_customer_for_order(p_search text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_customer_for_order(p_search text) IS 'Search customers by phone/name/email with partial matching';


--
-- Name: send_notification(uuid[], text, text, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_notification(p_user_ids uuid[], p_user_type text, p_title text, p_message text, p_type text DEFAULT 'system'::text, p_data jsonb DEFAULT NULL::jsonb, p_priority text DEFAULT 'normal'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    user_id UUID;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    FOREACH user_id IN ARRAY p_user_ids LOOP
        INSERT INTO notifications (user_id, user_type, title, message, type, data, priority, sent_by)
        VALUES (user_id, p_user_type, p_title, p_message, p_type::notification_type, p_data, p_priority, emp_id);
    END LOOP;
    
    RETURN json_build_object('success', true, 'count', array_length(p_user_ids, 1));
END;
$$;


--
-- Name: set_all_reviews_visibility(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_all_reviews_visibility(p_is_visible boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: submit_customer_review(uuid, integer, text, text, uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_customer_review(p_customer_id uuid, p_rating integer, p_comment text, p_review_type text DEFAULT 'overall'::text, p_item_id uuid DEFAULT NULL::uuid, p_meal_id uuid DEFAULT NULL::uuid, p_order_id uuid DEFAULT NULL::uuid, p_images jsonb DEFAULT '[]'::jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    review_count INTEGER;
    max_reviews INTEGER := 3;
    new_review_id UUID;
    is_verified BOOLEAN := false;
    v_review_type TEXT;
    v_item_id UUID;
    v_meal_id UUID;
BEGIN
    IF p_rating < 1 OR p_rating > 5 THEN
        RETURN json_build_object('success', false, 'error', 'Rating must be between 1 and 5');
    END IF;
    
    SELECT COUNT(*) INTO review_count FROM reviews
    WHERE customer_id = p_customer_id AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day';
    
    IF review_count >= max_reviews THEN
        RETURN json_build_object('success', false, 'error', 'Daily review limit reached.');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
        RETURN json_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    -- Check for verified review - cast status to text to avoid enum issues
    IF p_order_id IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND customer_id = p_customer_id AND status::text = 'delivered') THEN
        is_verified := true;
    END IF;
    
    -- Determine review type and set item_id/meal_id accordingly
    v_review_type := COALESCE(p_review_type, 'overall');
    v_item_id := NULL;
    v_meal_id := NULL;
    
    IF p_item_id IS NOT NULL AND EXISTS (SELECT 1 FROM menu_items WHERE id = p_item_id) THEN
        v_review_type := 'item';
        v_item_id := p_item_id;
    ELSIF p_meal_id IS NOT NULL AND EXISTS (SELECT 1 FROM meals WHERE id = p_meal_id) THEN
        v_review_type := 'meal';
        v_meal_id := p_meal_id;
    ELSE
        IF v_review_type NOT IN ('overall', 'service', 'delivery') THEN
            v_review_type := 'overall';
        END IF;
    END IF;
    
    INSERT INTO reviews (customer_id, order_id, item_id, meal_id, rating, comment, review_type, images, is_verified, is_visible)
    VALUES (p_customer_id, p_order_id, v_item_id, v_meal_id, p_rating, p_comment, v_review_type, COALESCE(p_images, '[]'::jsonb), is_verified, true)
    RETURNING id INTO new_review_id;
    
    IF v_item_id IS NOT NULL THEN
        UPDATE menu_items SET rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE item_id = v_item_id AND is_visible = true),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE item_id = v_item_id AND is_visible = true) WHERE id = v_item_id;
    END IF;
    
    IF v_meal_id IS NOT NULL THEN
        UPDATE meals SET rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true),
            total_reviews = (SELECT COUNT(*) FROM reviews WHERE meal_id = v_meal_id AND is_visible = true) WHERE id = v_meal_id;
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Review submitted successfully', 'review_id', new_review_id, 'is_verified', is_verified, 'reviews_remaining', max_reviews - review_count - 1);
END;
$$;


--
-- Name: test_promo_generation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_promo_generation(p_customer_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_total_customer_points INT;
    v_threshold_settings JSONB;
    v_threshold JSONB;
    v_expiry_days INT := 60;
    v_already_awarded INT[];
    v_threshold_points INT;
    v_new_code TEXT;
    v_reward_promo_code TEXT := NULL;
    v_reward_promo_generated BOOLEAN := FALSE;
    v_debug_log TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Step 1: Get total customer points
    SELECT COALESCE(SUM(points), 0)::INT
    INTO v_total_customer_points
    FROM loyalty_points
    WHERE customer_id = p_customer_id;
    
    v_debug_log := array_append(v_debug_log, 'Step 1: Total points = ' || v_total_customer_points);
    
    -- Step 2: Check if perks_settings table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'perks_settings') THEN
        RETURN json_build_object('success', false, 'error', 'perks_settings table does not exist', 'debug', v_debug_log);
    END IF;
    
    v_debug_log := array_append(v_debug_log, 'Step 2: perks_settings table exists');
    
    -- Step 3: Get already awarded thresholds from promo_codes table
    SELECT ARRAY_AGG(DISTINCT loyalty_points_required)
    INTO v_already_awarded
    FROM promo_codes
    WHERE customer_id = p_customer_id 
      AND loyalty_points_required IS NOT NULL;
    
    v_already_awarded := COALESCE(v_already_awarded, ARRAY[]::INT[]);
    v_debug_log := array_append(v_debug_log, 'Step 3: Already awarded = ' || v_already_awarded::TEXT);
    
    -- Step 4: Get loyalty thresholds
    SELECT setting_value INTO v_threshold_settings
    FROM perks_settings
    WHERE setting_key = 'loyalty_thresholds' AND is_active = true;
    
    IF v_threshold_settings IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No loyalty_thresholds found in perks_settings', 'debug', v_debug_log);
    END IF;
    
    v_debug_log := array_append(v_debug_log, 'Step 4: Thresholds = ' || v_threshold_settings::TEXT);
    
    IF jsonb_typeof(v_threshold_settings) != 'array' THEN
        RETURN json_build_object('success', false, 'error', 'loyalty_thresholds is not an array', 'debug', v_debug_log);
    END IF;
    
    -- Step 5: Get expiry days
    BEGIN
        SELECT COALESCE((setting_value->>'reward_codes')::INT, 60)
        INTO v_expiry_days
        FROM perks_settings
        WHERE setting_key = 'promo_expiry_days';
    EXCEPTION WHEN OTHERS THEN
        v_expiry_days := 60;
    END;
    
    v_debug_log := array_append(v_debug_log, 'Step 5: Expiry days = ' || v_expiry_days);
    
    -- Step 6: Process thresholds
    FOR v_threshold IN SELECT value FROM jsonb_array_elements(v_threshold_settings) AS value ORDER BY (value->>'points')::INT DESC
    LOOP
        v_threshold_points := (v_threshold->>'points')::INT;
        v_debug_log := array_append(v_debug_log, 'Step 6: Checking threshold ' || v_threshold_points || ' points');
        
        IF v_total_customer_points >= v_threshold_points 
           AND NOT (v_threshold_points = ANY(v_already_awarded)) THEN
            
            v_debug_log := array_append(v_debug_log, 'Step 6: Customer qualifies! Generating promo code...');
            
            -- Generate unique promo code
            v_new_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
            
            -- Ensure code is unique
            WHILE EXISTS (SELECT 1 FROM promo_codes WHERE code = v_new_code) LOOP
                v_new_code := 'ZOIRO-' || UPPER(SUBSTRING(MD5(p_customer_id::TEXT || NOW()::TEXT || random()::TEXT) FROM 1 FOR 8));
            END LOOP;
            
            v_debug_log := array_append(v_debug_log, 'Step 6: Generated code = ' || v_new_code);
            
            -- Insert into promo_codes table (single table for all promo codes)
            INSERT INTO promo_codes (
                code, name, description, promo_type, value, max_discount,
                valid_from, valid_until, usage_limit, current_usage, is_active,
                customer_id, loyalty_points_required
            ) VALUES (
                v_new_code, 
                COALESCE(v_threshold->>'promo_name', v_threshold_points || ' Points Reward'),
                'Loyalty reward for reaching ' || v_threshold_points || ' points',
                COALESCE(v_threshold->>'promo_type', 'percentage')::promo_type, 
                COALESCE((v_threshold->>'promo_value')::DECIMAL, 10), 
                (v_threshold->>'max_discount')::DECIMAL,
                NOW(), 
                NOW() + (v_expiry_days || ' days')::INTERVAL,
                1, 0, true,
                p_customer_id, v_threshold_points
            );
            
            v_debug_log := array_append(v_debug_log, 'Step 6: Inserted into promo_codes');
            
            v_reward_promo_code := v_new_code;
            v_reward_promo_generated := TRUE;
            
            EXIT;
        ELSE
            v_debug_log := array_append(v_debug_log, 'Step 6: Not eligible - points=' || v_total_customer_points || ', threshold=' || v_threshold_points || ', already_awarded=' || (v_threshold_points = ANY(v_already_awarded))::TEXT);
        END IF;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'promo_generated', v_reward_promo_generated,
        'promo_code', v_reward_promo_code,
        'customer_points', v_total_customer_points,
        'debug', v_debug_log
    );
END;
$$;


--
-- Name: toggle_2fa(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_2fa(p_customer_id uuid, p_enable boolean, p_secret text DEFAULT NULL::text) RETURNS TABLE(success boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE customers
    SET 
        is_2fa_enabled = p_enable,
        two_fa_secret = CASE WHEN p_enable THEN p_secret ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Customer not found';
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;


--
-- Name: toggle_all_promo_codes_admin(boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_all_promo_codes_admin(p_activate boolean, p_filter text DEFAULT 'all'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_count INT;
BEGIN
    IF p_filter = 'expired' THEN
        UPDATE promo_codes
        SET is_active = p_activate, updated_at = NOW()
        WHERE valid_until < NOW();
    ELSIF p_filter = 'active' THEN
        UPDATE promo_codes
        SET is_active = p_activate, updated_at = NOW()
        WHERE is_active = true;
    ELSIF p_filter = 'inactive' THEN
        UPDATE promo_codes
        SET is_active = p_activate, updated_at = NOW()
        WHERE is_active = false;
    ELSE
        UPDATE promo_codes
        SET is_active = p_activate, updated_at = NOW();
    END IF;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true, 
        'updated_count', v_count,
        'action', CASE WHEN p_activate THEN 'activated' ELSE 'deactivated' END,
        'message', v_count || ' promo codes ' || CASE WHEN p_activate THEN 'activated' ELSE 'deactivated' END
    );
END;
$$;


--
-- Name: toggle_block_employee(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_block_employee(p_employee_id uuid, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_employee RECORD;
  v_new_portal_enabled BOOLEAN;
  v_action TEXT;
BEGIN
  -- Get current employee status
  SELECT id, name, portal_enabled, block_reason
  INTO v_employee
  FROM employees 
  WHERE id = p_employee_id;

  IF v_employee IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Toggle portal_enabled only
  IF v_employee.portal_enabled = false THEN
    -- UNBLOCK: Set portal_enabled to true
    v_new_portal_enabled := true;
    v_action := 'unblocked';
    
    UPDATE employees SET
      portal_enabled = true,
      block_reason = NULL,
      updated_at = NOW()
    WHERE id = p_employee_id;
  ELSE
    -- BLOCK: Set portal_enabled to false
    v_new_portal_enabled := false;
    v_action := 'blocked';
    
    UPDATE employees SET
      portal_enabled = false,
      block_reason = COALESCE(p_reason, 'Account blocked by administrator'),
      updated_at = NOW()
    WHERE id = p_employee_id;
  END IF;

  -- Log in audit
  INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data)
  VALUES (
    v_action || '_employee', 
    'employees', 
    p_employee_id, 
    jsonb_build_object('portal_enabled', v_employee.portal_enabled),
    jsonb_build_object('portal_enabled', v_new_portal_enabled, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', v_action,
    'portal_enabled', v_new_portal_enabled,
    'message', v_employee.name || ' has been ' || v_action
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: toggle_deal_active(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_deal_active(p_deal_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_new_status BOOLEAN;
BEGIN
    UPDATE deals SET is_active = NOT is_active, updated_at = NOW() WHERE id = p_deal_id RETURNING is_active INTO v_new_status;
    RETURN json_build_object('success', true, 'is_active', v_new_status);
END;
$$;


--
-- Name: toggle_deal_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_deal_status(p_deal_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE promo_codes
    SET is_active = NOT is_active,
        updated_at = NOW()
    WHERE id = p_deal_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: toggle_employee_portal(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_employee_portal(p_employee_id uuid, p_enabled boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_name TEXT;
BEGIN
  UPDATE employees SET
    portal_enabled = p_enabled,
    updated_at = NOW()
  WHERE id = p_employee_id
  RETURNING name INTO v_name;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'portal_enabled', p_enabled,
    'message', 'Portal access ' || CASE WHEN p_enabled THEN 'enabled' ELSE 'disabled' END || ' for ' || v_name
  );
END;
$$;


--
-- Name: toggle_employee_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_employee_status(p_employee_id uuid, p_status text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admin can change employee status';
    END IF;
    
    UPDATE employees
    SET status = p_status::employee_status,
        portal_enabled = (p_status = 'active'),
        updated_at = NOW()
    WHERE id = p_employee_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: toggle_favorite(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_favorite(p_customer_id uuid, p_item_id text, p_item_type text DEFAULT 'menu_item'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: toggle_maintenance_mode(boolean, text, text, text, text, timestamp with time zone, boolean, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_maintenance_mode(p_is_enabled boolean, p_reason_type text DEFAULT 'update'::text, p_custom_reason text DEFAULT NULL::text, p_title text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_estimated_restore_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_show_timer boolean DEFAULT true, p_show_progress boolean DEFAULT true, p_employee_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_maint_id UUID;
BEGIN
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_reason_type NOT IN ('update', 'bug_fix', 'changes', 'scheduled', 'custom') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid reason type');
    END IF;
    
    UPDATE maintenance_mode SET
        is_enabled = p_is_enabled,
        reason_type = p_reason_type,
        custom_reason = CASE WHEN p_reason_type = 'custom' THEN COALESCE(p_custom_reason, custom_reason) ELSE NULL END,
        title = COALESCE(NULLIF(p_title, ''), title, 'We''ll Be Right Back'),
        message = COALESCE(NULLIF(p_message, ''), message),
        estimated_restore_time = p_estimated_restore_time,
        show_timer = p_show_timer,
        show_progress = p_show_progress,
        enabled_at = CASE WHEN p_is_enabled THEN NOW() ELSE NULL END,
        enabled_by = CASE WHEN p_is_enabled THEN p_employee_id ELSE NULL END,
        updated_at = NOW()
    WHERE id = (SELECT id FROM maintenance_mode LIMIT 1)
    RETURNING id INTO v_maint_id;
    
    IF v_maint_id IS NULL THEN
        INSERT INTO maintenance_mode (is_enabled, reason_type, custom_reason, title, message, estimated_restore_time, show_timer, show_progress, enabled_at, enabled_by)
        VALUES (p_is_enabled, p_reason_type, p_custom_reason, p_title, p_message, p_estimated_restore_time, p_show_timer, p_show_progress,
            CASE WHEN p_is_enabled THEN NOW() ELSE NULL END, CASE WHEN p_is_enabled THEN p_employee_id ELSE NULL END)
        RETURNING id INTO v_maint_id;
    END IF;
    
    RETURN json_build_object('success', true, 'is_enabled', p_is_enabled);
END;
$$;


--
-- Name: FUNCTION toggle_maintenance_mode(p_is_enabled boolean, p_reason_type text, p_custom_reason text, p_title text, p_message text, p_estimated_restore_time timestamp with time zone, p_show_timer boolean, p_show_progress boolean, p_employee_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.toggle_maintenance_mode(p_is_enabled boolean, p_reason_type text, p_custom_reason text, p_title text, p_message text, p_estimated_restore_time timestamp with time zone, p_show_timer boolean, p_show_progress boolean, p_employee_id uuid) IS 'Admin: Toggle maintenance mode with details';


--
-- Name: toggle_payment_method_status(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_payment_method_status(p_id uuid, p_is_active boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE payment_methods 
    SET is_active = p_is_active, updated_at = NOW()
    WHERE id = p_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'is_active', p_is_active,
        'message', CASE WHEN p_is_active THEN 'Payment method activated' ELSE 'Payment method deactivated' END
    );
END;
$$;


--
-- Name: FUNCTION toggle_payment_method_status(p_id uuid, p_is_active boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.toggle_payment_method_status(p_id uuid, p_is_active boolean) IS 'Admin: Quick toggle payment method active status';


--
-- Name: toggle_payment_method_status_internal(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_payment_method_status_internal(p_id uuid, p_is_active boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    UPDATE payment_methods SET is_active = p_is_active, updated_at = NOW() WHERE id = p_id;
    RETURN json_build_object('success', true, 'is_active', p_is_active, 'message', 'Status updated');
END;
$$;


--
-- Name: trigger_password_recovery_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_password_recovery_email(p_email text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_customer RECORD;
  v_auth_user RECORD;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Get customer
  SELECT id, auth_user_id, email, name
  INTO v_customer
  FROM public.customers
  WHERE email = p_email;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;
  
  IF v_customer.auth_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No auth account linked'
    );
  END IF;
  
  -- Get auth user details
  SELECT id, email, email_confirmed_at, banned_until, deleted_at
  INTO v_auth_user
  FROM auth.users
  WHERE id = v_customer.auth_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Auth user not found'
    );
  END IF;
  
  IF v_auth_user.deleted_at IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Account is deleted'
    );
  END IF;
  
  IF v_auth_user.banned_until IS NOT NULL AND v_auth_user.banned_until > NOW() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Account is banned'
    );
  END IF;
  
  -- Return success - the API will use Supabase's resetPasswordForEmail
  RETURN json_build_object(
    'success', true,
    'auth_user_id', v_auth_user.id,
    'email', v_auth_user.email,
    'email_confirmed', v_auth_user.email_confirmed_at IS NOT NULL,
    'use_recovery_email', true
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


--
-- Name: FUNCTION trigger_password_recovery_email(p_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_password_recovery_email(p_email text) IS 'Validates customer and returns info to trigger Supabase password recovery email';


--
-- Name: unban_customer(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unban_customer(p_customer_id uuid, p_unbanned_by uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_customer RECORD;
BEGIN
    -- Get customer info
    SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
    
    IF v_customer IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
    END IF;
    
    IF v_customer.is_banned = false OR v_customer.is_banned IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer is not banned');
    END IF;
    
    -- Unban the customer
    UPDATE customers SET
        is_banned = false,
        unbanned_at = NOW(),
        unbanned_by = p_unbanned_by
    WHERE id = p_customer_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Customer unbanned successfully',
        'customer_name', v_customer.name,
        'customer_email', v_customer.email
    );
END;
$$;


--
-- Name: update_contact_message_priority(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contact_message_priority(p_message_id uuid, p_priority text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: update_contact_message_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contact_message_status(p_message_id uuid, p_status text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: update_customer_auth_user_id(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_customer_auth_user_id(p_email text, p_auth_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    UPDATE customers
    SET 
        auth_user_id = p_auth_user_id,
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(p_email);
    
    RETURN FOUND;
END;
$$;


--
-- Name: update_customer_profile(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_customer_profile(p_customer_id uuid, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text) RETURNS TABLE(success boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if phone is taken by another customer
    IF p_phone IS NOT NULL AND EXISTS (
        SELECT 1 FROM customers 
        WHERE phone = p_phone AND id != p_customer_id
    ) THEN
        RETURN QUERY SELECT FALSE, 'Phone number already in use';
        RETURN;
    END IF;

    -- Update profile
    UPDATE customers
    SET 
        name = COALESCE(p_name, name),
        phone = COALESCE(p_phone, phone),
        address = COALESCE(p_address, address),
        updated_at = NOW()
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Customer not found';
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;


--
-- Name: update_deal(uuid, text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_deal(p_deal_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_image_url text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE deals
    SET 
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        is_active = COALESCE(p_is_active, is_active),
        image_url = COALESCE(p_image_url, image_url),
        updated_at = NOW()
    WHERE id = p_deal_id
    RETURNING jsonb_build_object(
        'id', id,
        'name', name,
        'is_active', is_active,
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


--
-- Name: update_deal(uuid, text, text, numeric, numeric, numeric, timestamp without time zone, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_deal(p_deal_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_discount_value numeric DEFAULT NULL::numeric, p_min_order_amount numeric DEFAULT NULL::numeric, p_max_discount numeric DEFAULT NULL::numeric, p_end_date timestamp without time zone DEFAULT NULL::timestamp without time zone, p_is_active boolean DEFAULT NULL::boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE promo_codes SET
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        value = COALESCE(p_discount_value, value),
        min_order_amount = COALESCE(p_min_order_amount, min_order_amount),
        max_discount = COALESCE(p_max_discount, max_discount),
        valid_until = COALESCE(p_end_date, valid_until),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE id = p_deal_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: update_deal_with_items(uuid, text, text, numeric, numeric, text, timestamp without time zone, integer, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_deal_with_items(p_deal_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_original_price numeric DEFAULT NULL::numeric, p_discounted_price numeric DEFAULT NULL::numeric, p_image_url text DEFAULT NULL::text, p_valid_until timestamp without time zone DEFAULT NULL::timestamp without time zone, p_usage_limit integer DEFAULT NULL::integer, p_is_active boolean DEFAULT NULL::boolean, p_items jsonb DEFAULT NULL::jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_discount_pct DECIMAL(5,2);
    v_item JSONB;
    v_orig DECIMAL(10,2);
    v_disc DECIMAL(10,2);
BEGIN
    SELECT original_price, discounted_price INTO v_orig, v_disc FROM deals WHERE id = p_deal_id;
    v_orig := COALESCE(p_original_price, v_orig);
    v_disc := COALESCE(p_discounted_price, v_disc);
    v_discount_pct := CASE WHEN v_orig > 0 THEN ROUND((1 - (v_disc / v_orig)) * 100, 2) ELSE 0 END;
    
    UPDATE deals SET
        name = COALESCE(p_name, name), description = COALESCE(p_description, description),
        original_price = COALESCE(p_original_price, original_price), discounted_price = COALESCE(p_discounted_price, discounted_price),
        discount_percentage = v_discount_pct, image_url = COALESCE(p_image_url, image_url),
        valid_until = COALESCE(p_valid_until, valid_until), usage_limit = COALESCE(p_usage_limit, usage_limit),
        is_active = COALESCE(p_is_active, is_active), updated_at = NOW()
    WHERE id = p_deal_id;
    
    IF p_items IS NOT NULL THEN
        DELETE FROM deal_items WHERE deal_id = p_deal_id;
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO deal_items (deal_id, menu_item_id, quantity)
            VALUES (p_deal_id, (v_item->>'id')::UUID, COALESCE((v_item->>'quantity')::INTEGER, 1))
            ON CONFLICT (deal_id, menu_item_id) DO UPDATE SET quantity = EXCLUDED.quantity;
        END LOOP;
    END IF;
    
    RETURN json_build_object('success', true, 'id', p_deal_id);
END;
$$;


--
-- Name: update_deal_with_items(uuid, text, text, text, numeric, numeric, text, timestamp with time zone, timestamp with time zone, integer, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_deal_with_items(p_deal_id uuid, p_name text, p_description text, p_code text, p_original_price numeric, p_discounted_price numeric, p_image_url text, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone, p_usage_limit integer, p_is_active boolean, p_items jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_discount_percentage DECIMAL;
    v_item JSONB;
BEGIN
    -- Calculate discount percentage
    IF p_original_price > 0 THEN
        v_discount_percentage := ROUND(((p_original_price - p_discounted_price) / p_original_price) * 100, 2);
    ELSE
        v_discount_percentage := 0;
    END IF;
    
    -- Update the deal
    UPDATE deals SET
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        code = COALESCE(NULLIF(TRIM(p_code), ''), code),
        original_price = COALESCE(p_original_price, original_price),
        discounted_price = COALESCE(p_discounted_price, discounted_price),
        discount_percentage = v_discount_percentage,
        images = CASE WHEN p_image_url IS NOT NULL THEN jsonb_build_array(p_image_url) ELSE images END,
        valid_from = COALESCE(p_valid_from, valid_from),
        valid_until = COALESCE(p_valid_until, valid_until),
        usage_limit = COALESCE(p_usage_limit, usage_limit),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE id = p_deal_id;
    
    -- Replace deal_items (delete old, insert new)
    IF p_items IS NOT NULL THEN
        DELETE FROM deal_items WHERE deal_id = p_deal_id;
        
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO deal_items (deal_id, menu_item_id, quantity)
            VALUES (
                p_deal_id,
                (v_item->>'id')::UUID,
                COALESCE((v_item->>'quantity')::INT, 1)
            );
        END LOOP;
    END IF;
    
    RETURN json_build_object('success', true, 'id', p_deal_id);
END;
$$;


--
-- Name: update_employee(uuid, text, text, public.user_role, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_employee(p_employee_id uuid, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_role public.user_role DEFAULT NULL::public.user_role, p_permissions jsonb DEFAULT NULL::jsonb, p_status text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
    v_old_avatar TEXT;
BEGIN
    -- Get old avatar URL for cleanup if being replaced
    SELECT avatar_url INTO v_old_avatar FROM employees WHERE id = p_employee_id;
    
    UPDATE employees
    SET 
        name = COALESCE(p_name, name),
        phone = COALESCE(p_phone, phone),
        role = COALESCE(p_role, role),
        permissions = COALESCE(p_permissions, permissions),
        status = COALESCE(p_status::employee_status, status),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = NOW()
    WHERE id = p_employee_id
    RETURNING jsonb_build_object(
        'id', id,
        'employee_id', employee_id,
        'name', name,
        'phone', phone,
        'role', role,
        'status', status,
        'avatar_url', avatar_url,
        'old_avatar_url', v_old_avatar,
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


--
-- Name: update_employee_2fa_login(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_employee_2fa_login(p_employee_id uuid, p_auth_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Update last_login and optionally auth_user_id
    IF p_auth_user_id IS NOT NULL THEN
        UPDATE employees
        SET 
            last_login = NOW(),
            auth_user_id = p_auth_user_id,
            updated_at = NOW()
        WHERE id = p_employee_id;
    ELSE
        UPDATE employees
        SET 
            last_login = NOW(),
            updated_at = NOW()
        WHERE id = p_employee_id;
    END IF;
    
    RETURN jsonb_build_object('success', true);
END;
$$;


--
-- Name: update_employee_avatar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_employee_avatar(p_employee_id uuid, p_avatar_url text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_old_avatar TEXT;
BEGIN
  SELECT avatar_url INTO v_old_avatar FROM employees WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  UPDATE employees SET 
    avatar_url = p_avatar_url,
    updated_at = NOW()
  WHERE id = p_employee_id;

  RETURN jsonb_build_object(
    'success', true,
    'old_avatar_url', v_old_avatar,  -- Return old URL for cleanup
    'new_avatar_url', p_avatar_url
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: update_employee_avatar_v2(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_employee_avatar_v2(p_employee_id uuid, p_avatar_url text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_old_avatar TEXT;
    v_name TEXT;
BEGIN
    SELECT avatar_url, name INTO v_old_avatar, v_name FROM employees WHERE id = p_employee_id;

    IF v_name IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Employee not found');
    END IF;

    UPDATE employees SET avatar_url = p_avatar_url, updated_at = NOW() WHERE id = p_employee_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'old_avatar_url', v_old_avatar,
        'new_avatar_url', p_avatar_url,
        'message', 'Avatar updated for ' || v_name
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;


--
-- Name: update_employee_complete(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_employee_complete(p_employee_id uuid, p_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_old_data JSONB;
  v_updated BOOLEAN := false;
BEGIN
  -- Check if employee exists
  SELECT jsonb_build_object(
    'name', name,
    'email', email,
    'phone', phone,
    'role', role::TEXT,
    'status', status::TEXT
  ) INTO v_old_data
  FROM employees WHERE id = p_employee_id;

  IF v_old_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Check for email uniqueness if changing email
  IF p_data->>'email' IS NOT NULL AND p_data->>'email' != v_old_data->>'email' THEN
    IF EXISTS (SELECT 1 FROM employees WHERE email = p_data->>'email' AND id != p_employee_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Email already in use');
    END IF;
  END IF;

  -- Check for phone uniqueness if changing phone
  IF p_data->>'phone' IS NOT NULL AND p_data->>'phone' != v_old_data->>'phone' THEN
    IF EXISTS (SELECT 1 FROM employees WHERE phone = p_data->>'phone' AND id != p_employee_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Phone number already in use');
    END IF;
  END IF;

  -- Update employee (NO ROLE UPDATE - that requires admin)
  UPDATE employees SET
    name = COALESCE(p_data->>'name', name),
    email = COALESCE(p_data->>'email', email),
    phone = COALESCE(p_data->>'phone', phone),
    address = COALESCE(p_data->>'address', address),
    emergency_contact = COALESCE(p_data->>'emergency_contact', emergency_contact),
    emergency_contact_name = COALESCE(p_data->>'emergency_contact_name', emergency_contact_name),
    date_of_birth = CASE WHEN p_data->>'date_of_birth' IS NOT NULL THEN (p_data->>'date_of_birth')::DATE ELSE date_of_birth END,
    blood_group = COALESCE(p_data->>'blood_group', blood_group),
    avatar_url = COALESCE(p_data->>'avatar_url', avatar_url),
    notes = COALESCE(p_data->>'notes', notes),
    salary = CASE WHEN p_data ? 'salary' THEN (p_data->>'salary')::NUMERIC ELSE salary END,
    portal_enabled = CASE WHEN p_data ? 'portal_enabled' THEN (p_data->>'portal_enabled')::BOOLEAN ELSE portal_enabled END,
    permissions = CASE WHEN p_data ? 'permissions' THEN (p_data->'permissions')::JSONB ELSE permissions END,
    bank_details = CASE WHEN p_data ? 'bank_details' THEN (p_data->'bank_details')::JSONB ELSE bank_details END,
    updated_at = NOW()
  WHERE id = p_employee_id;

  v_updated := FOUND;

  RETURN jsonb_build_object(
    'success', v_updated,
    'message', CASE WHEN v_updated THEN 'Employee updated successfully' ELSE 'No changes made' END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: update_employee_salary(uuid, numeric, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_employee_salary(p_employee_id uuid, p_new_salary numeric, p_payment_frequency text DEFAULT NULL::text, p_bank_details jsonb DEFAULT NULL::jsonb, p_updated_by uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_old_salary DECIMAL;
    v_emp_name TEXT;
BEGIN
    -- Get current salary
    SELECT salary, name INTO v_old_salary, v_emp_name 
    FROM employees WHERE id = p_employee_id;
    
    IF v_emp_name IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Employee not found');
    END IF;

    -- Update employee salary
    UPDATE employees SET 
        salary = p_new_salary,
        bank_details = COALESCE(p_bank_details, bank_details),
        updated_at = NOW()
    WHERE id = p_employee_id;

    -- Update or insert employee_payroll record for current month
    INSERT INTO employee_payroll (
        employee_id, month, year, base_salary, 
        payment_frequency, bank_details, total_amount
    ) VALUES (
        p_employee_id, 
        EXTRACT(MONTH FROM CURRENT_DATE)::int,
        EXTRACT(YEAR FROM CURRENT_DATE)::int,
        p_new_salary,
        COALESCE(p_payment_frequency, 'monthly'),
        COALESCE(p_bank_details, '{}'::jsonb),
        p_new_salary
    )
    ON CONFLICT (employee_id, month, year) DO UPDATE SET 
        base_salary = p_new_salary,
        payment_frequency = COALESCE(p_payment_frequency, employee_payroll.payment_frequency),
        bank_details = COALESCE(p_bank_details, employee_payroll.bank_details),
        total_amount = p_new_salary + COALESCE(employee_payroll.bonus, 0) - COALESCE(employee_payroll.deductions, 0),
        updated_at = NOW();

    RETURN json_build_object(
        'success', true,
        'employee_name', v_emp_name,
        'old_salary', v_old_salary,
        'new_salary', p_new_salary
    );
END;
$$;


--
-- Name: update_inventory_item(uuid, text, text, text, text, numeric, numeric, numeric, text, text, text, text, date, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_inventory_item(p_item_id uuid, p_name text DEFAULT NULL::text, p_sku text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_unit text DEFAULT NULL::text, p_min_quantity numeric DEFAULT NULL::numeric, p_max_quantity numeric DEFAULT NULL::numeric, p_cost_per_unit numeric DEFAULT NULL::numeric, p_supplier text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_expiry_date date DEFAULT NULL::date, p_reorder_point numeric DEFAULT NULL::numeric, p_lead_time_days integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if item exists
    IF NOT EXISTS (SELECT 1 FROM inventory WHERE id = p_item_id) THEN
        RETURN json_build_object('success', false, 'error', 'Item not found');
    END IF;
    
    -- Check for duplicate SKU if being updated
    IF p_sku IS NOT NULL AND EXISTS (SELECT 1 FROM inventory WHERE sku = p_sku AND id != p_item_id) THEN
        RETURN json_build_object('success', false, 'error', 'SKU already exists');
    END IF;
    
    UPDATE inventory SET
        name = COALESCE(p_name, name),
        sku = COALESCE(p_sku, sku),
        category = COALESCE(p_category, category),
        unit = COALESCE(p_unit, unit),
        min_quantity = COALESCE(p_min_quantity, min_quantity),
        max_quantity = COALESCE(p_max_quantity, max_quantity),
        cost_per_unit = COALESCE(p_cost_per_unit, cost_per_unit),
        supplier = COALESCE(p_supplier, supplier),
        notes = COALESCE(p_notes, notes),
        location = COALESCE(p_location, location),
        barcode = COALESCE(p_barcode, barcode),
        expiry_date = COALESCE(p_expiry_date, expiry_date),
        reorder_point = COALESCE(p_reorder_point, reorder_point),
        lead_time_days = COALESCE(p_lead_time_days, lead_time_days),
        updated_at = NOW()
    WHERE id = p_item_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: update_kitchen_order_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_kitchen_order_status(p_order_id uuid, p_status text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    order_record RECORD;
    result JSON;
BEGIN
    -- Get current employee
    emp_id := get_employee_id();
    
    -- Update order
    UPDATE orders
    SET status = p_status::order_status,
        prepared_by = emp_id,
        kitchen_started_at = CASE WHEN p_status = 'preparing' THEN NOW() ELSE kitchen_started_at END,
        kitchen_completed_at = CASE WHEN p_status = 'ready' THEN NOW() ELSE kitchen_completed_at END,
        updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO order_record;
    
    IF order_record IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Insert status history
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (p_order_id, p_status::order_status, emp_id);
    
    -- Create notification for waiter if order is ready
    IF p_status = 'ready' AND order_record.waiter_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, user_type, title, message, type, data)
        VALUES (
            order_record.waiter_id,
            'employee',
            'Order Ready',
            'Order #' || order_record.order_number || ' is ready for pickup',
            'order',
            json_build_object(
                'order_id', order_record.id,
                'order_number', order_record.order_number,
                'table_number', order_record.table_number
            )::jsonb
        );
    END IF;
    
    -- Return updated order
    result := json_build_object(
        'success', true,
        'order_id', p_order_id,
        'new_status', p_status,
        'updated_at', NOW()
    );
    
    RETURN result;
END;
$$;


--
-- Name: update_maintenance_email_sent(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_maintenance_email_sent(p_count integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE maintenance_mode SET
        email_sent_at = NOW(),
        email_sent_count = p_count,
        updated_at = NOW();
    
    RETURN json_build_object('success', true, 'sent_count', p_count);
END;
$$;


--
-- Name: update_menu_category(uuid, text, text, text, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_menu_category(p_category_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_display_order integer DEFAULT NULL::integer, p_is_visible boolean DEFAULT NULL::boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE menu_categories
    SET 
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        image_url = COALESCE(p_image_url, image_url),
        display_order = COALESCE(p_display_order, display_order),
        is_visible = COALESCE(p_is_visible, is_visible),
        updated_at = NOW()
    WHERE id = p_category_id
    RETURNING jsonb_build_object(
        'id', id,
        'name', name,
        'slug', slug,
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


--
-- Name: update_menu_item(uuid, text, text, numeric, jsonb, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_menu_item(p_item_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT NULL::numeric, p_images jsonb DEFAULT NULL::jsonb, p_is_available boolean DEFAULT NULL::boolean, p_is_featured boolean DEFAULT NULL::boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Note: Portal access already requires authentication
    -- The SECURITY DEFINER bypasses RLS for the update

    UPDATE menu_items
    SET 
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        price = COALESCE(p_price, price),
        images = COALESCE(p_images, images),
        is_available = COALESCE(p_is_available, is_available),
        is_featured = COALESCE(p_is_featured, is_featured),
        updated_at = NOW()
    WHERE id = p_item_id
    RETURNING jsonb_build_object(
        'id', id,
        'name', name,
        'price', price,
        'is_available', is_available,
        'is_featured', is_featured,
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN COALESCE(v_result, jsonb_build_object('success', false, 'message', 'Item not found'));
END;
$$;


--
-- Name: update_menu_item_advanced(uuid, text, text, numeric, uuid, text[], boolean, boolean, boolean, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_menu_item_advanced(p_item_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT NULL::numeric, p_category_id uuid DEFAULT NULL::uuid, p_images text[] DEFAULT NULL::text[], p_is_available boolean DEFAULT NULL::boolean, p_is_featured boolean DEFAULT NULL::boolean, p_is_spicy boolean DEFAULT NULL::boolean, p_is_vegetarian boolean DEFAULT NULL::boolean, p_preparation_time integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
        images = COALESCE(p_images, images),
        is_available = COALESCE(p_is_available, is_available),
        is_featured = COALESCE(p_is_featured, is_featured),
        is_spicy = COALESCE(p_is_spicy, is_spicy),
        is_vegetarian = COALESCE(p_is_vegetarian, is_vegetarian),
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
$$;


--
-- Name: update_menu_item_advanced(uuid, text, text, numeric, uuid, text[], boolean, boolean, integer, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_menu_item_advanced(p_item_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT NULL::numeric, p_category_id uuid DEFAULT NULL::uuid, p_images text[] DEFAULT NULL::text[], p_is_available boolean DEFAULT NULL::boolean, p_is_featured boolean DEFAULT NULL::boolean, p_preparation_time integer DEFAULT NULL::integer, p_has_variants boolean DEFAULT NULL::boolean, p_size_variants jsonb DEFAULT NULL::jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: update_menu_item_advanced(uuid, text, text, numeric, numeric, uuid, text[], boolean, boolean, boolean, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_menu_item_advanced(p_item_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price numeric DEFAULT NULL::numeric, p_sale_price numeric DEFAULT NULL::numeric, p_category_id uuid DEFAULT NULL::uuid, p_images text[] DEFAULT NULL::text[], p_is_available boolean DEFAULT NULL::boolean, p_is_featured boolean DEFAULT NULL::boolean, p_is_spicy boolean DEFAULT NULL::boolean, p_is_vegetarian boolean DEFAULT NULL::boolean, p_preparation_time integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
        sale_price = CASE WHEN p_sale_price IS NOT NULL THEN p_sale_price ELSE sale_price END,
        category_id = COALESCE(p_category_id, category_id),
        images = COALESCE(p_images, images),
        is_available = COALESCE(p_is_available, is_available),
        is_featured = COALESCE(p_is_featured, is_featured),
        is_spicy = COALESCE(p_is_spicy, is_spicy),
        is_vegetarian = COALESCE(p_is_vegetarian, is_vegetarian),
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
$$;


--
-- Name: update_order_status(uuid, public.order_status, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_order_status(p_order_id uuid, p_new_status public.order_status, p_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_customer_id UUID;
    v_status_message TEXT;
BEGIN
    -- Update order status
    UPDATE orders
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_order_id
    RETURNING customer_id INTO v_customer_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Add to status history
    INSERT INTO order_status_history (order_id, status, notes)
    VALUES (p_order_id, p_new_status, p_notes);
    
    -- Create notification based on status
    v_status_message := CASE p_new_status
        WHEN 'confirmed' THEN 'Your order has been confirmed'
        WHEN 'preparing' THEN 'Your order is being prepared'
        WHEN 'ready' THEN 'Your order is ready for pickup'
        WHEN 'out_for_delivery' THEN 'Your order is out for delivery'
        WHEN 'delivered' THEN 'Your order has been delivered'
        WHEN 'completed' THEN 'Your order is completed'
        WHEN 'cancelled' THEN 'Your order has been cancelled'
        ELSE 'Order status updated'
    END;
    
    INSERT INTO notifications (user_type, user_id, title, message, type)
    VALUES ('customer', v_customer_id, 'Order Update', v_status_message, 'order');
    
    RETURN TRUE;
END;
$$;


--
-- Name: update_order_status_kitchen(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_order_status_kitchen(p_order_id uuid, p_status text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    order_record RECORD;
BEGIN
    IF NOT can_access_kitchen() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    -- Update order
    UPDATE orders
    SET status = p_status::order_status,
        prepared_by = emp_id,
        kitchen_started_at = CASE WHEN p_status = 'preparing' THEN NOW() ELSE kitchen_started_at END,
        kitchen_completed_at = CASE WHEN p_status = 'ready' THEN NOW() ELSE kitchen_completed_at END,
        updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO order_record;
    
    -- Insert status history
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (p_order_id, p_status::order_status, emp_id);
    
    -- Create notification for waiter
    IF p_status = 'ready' AND order_record.waiter_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, user_type, title, message, type, data)
        VALUES (
            order_record.waiter_id,
            'employee',
            'Order Ready',
            'Order #' || order_record.order_number || ' is ready for serving',
            'order',
            json_build_object('order_id', p_order_id, 'order_number', order_record.order_number)
        );
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: update_order_status_quick(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_order_status_quick(p_order_id uuid, p_status text, p_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    emp_id UUID;
    order_record RECORD;
BEGIN
    -- Get current employee (may be null for system updates)
    BEGIN
        emp_id := get_employee_id();
    EXCEPTION WHEN OTHERS THEN
        emp_id := NULL;
    END;

    -- Update order with timestamps based on status
    UPDATE orders
    SET 
        status = p_status::order_status,
        kitchen_started_at = CASE 
            WHEN p_status = 'preparing' AND kitchen_started_at IS NULL THEN NOW() 
            ELSE kitchen_started_at 
        END,
        kitchen_completed_at = CASE 
            WHEN p_status = 'ready' THEN NOW() 
            ELSE kitchen_completed_at 
        END,
        delivery_started_at = CASE 
            WHEN p_status = 'delivering' AND delivery_started_at IS NULL THEN NOW() 
            ELSE delivery_started_at 
        END,
        delivered_at = CASE 
            WHEN p_status = 'delivered' THEN NOW() 
            ELSE delivered_at 
        END,
        prepared_by = CASE 
            WHEN p_status IN ('preparing', 'ready') AND emp_id IS NOT NULL THEN emp_id 
            ELSE prepared_by 
        END,
        delivery_rider_id = CASE 
            WHEN p_status = 'delivering' AND emp_id IS NOT NULL THEN emp_id 
            ELSE delivery_rider_id 
        END,
        updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO order_record;

    IF order_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, p_status::order_status, emp_id, p_notes);

    -- Return success with key fields for UI update
    RETURN json_build_object(
        'success', true,
        'order_id', order_record.id,
        'new_status', p_status,
        'updated_at', order_record.updated_at
    );
END;
$$;


--
-- Name: FUNCTION update_order_status_quick(p_order_id uuid, p_status text, p_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_order_status_quick(p_order_id uuid, p_status text, p_notes text) IS 'Fast status update with automatic timestamp management.';


--
-- Name: update_order_status_rpc(uuid, public.order_status, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_order_status_rpc(p_order_id uuid, p_new_status public.order_status, p_changed_by uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_assigned_to uuid DEFAULT NULL::uuid) RETURNS TABLE(success boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_customer_id UUID;
    v_order_number TEXT;
    v_status_message TEXT;
    v_old_status order_status;
BEGIN
    -- Get order info
    SELECT customer_id, order_number, status 
    INTO v_customer_id, v_order_number, v_old_status
    FROM orders WHERE id = p_order_id;

    IF v_customer_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Order not found';
        RETURN;
    END IF;

    -- Validate status transition
    IF v_old_status = p_new_status THEN
        RETURN QUERY SELECT FALSE, 'Order already has this status';
        RETURN;
    END IF;

    -- Update order
    UPDATE orders
    SET 
        status = p_new_status,
        assigned_to = COALESCE(p_assigned_to, assigned_to),
        delivered_at = CASE WHEN p_new_status = 'delivered' THEN NOW() ELSE delivered_at END,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Add to status history
    INSERT INTO order_status_history (order_id, status, changed_by, notes)
    VALUES (p_order_id, p_new_status, p_changed_by, p_notes);

    -- Get status message
    v_status_message := CASE p_new_status
        WHEN 'confirmed' THEN 'Your order ' || v_order_number || ' has been confirmed! ðŸ‘'
        WHEN 'preparing' THEN 'Your order ' || v_order_number || ' is being prepared! ðŸ‘¨â€ðŸ³'
        WHEN 'ready' THEN 'Your order ' || v_order_number || ' is ready! ðŸ—'
        WHEN 'delivering' THEN 'Your order ' || v_order_number || ' is on the way! ðŸ›µ'
        WHEN 'delivered' THEN 'Your order ' || v_order_number || ' has been delivered! Enjoy! ðŸ˜‹'
        WHEN 'cancelled' THEN 'Your order ' || v_order_number || ' has been cancelled.'
        ELSE 'Order status updated'
    END;

    -- Create notification
    INSERT INTO notifications (user_type, user_id, title, message, type, data)
    VALUES (
        'customer', v_customer_id,
        'Order Update',
        v_status_message,
        'order',
        jsonb_build_object('order_id', p_order_id, 'status', p_new_status)
    );

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;


--
-- Name: update_payment_method(uuid, text, text, text, text, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_payment_method(p_id uuid, p_method_type text DEFAULT NULL::text, p_method_name text DEFAULT NULL::text, p_account_number text DEFAULT NULL::text, p_account_holder_name text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_display_order integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Authorization check
    IF NOT is_manager_or_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Check if payment method exists
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    -- Validate method type if provided
    IF p_method_type IS NOT NULL AND p_method_type NOT IN ('jazzcash', 'easypaisa', 'bank') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid method type');
    END IF;
    
    -- Update payment method
    UPDATE payment_methods SET
        method_type = COALESCE(p_method_type, method_type),
        method_name = COALESCE(NULLIF(TRIM(p_method_name), ''), method_name),
        account_number = COALESCE(NULLIF(TRIM(p_account_number), ''), account_number),
        account_holder_name = COALESCE(NULLIF(TRIM(p_account_holder_name), ''), account_holder_name),
        bank_name = CASE 
            WHEN p_bank_name IS NOT NULL THEN NULLIF(TRIM(p_bank_name), '')
            ELSE bank_name 
        END,
        is_active = COALESCE(p_is_active, is_active),
        display_order = COALESCE(p_display_order, display_order),
        updated_at = NOW()
    WHERE id = p_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Payment method updated successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;


--
-- Name: FUNCTION update_payment_method(p_id uuid, p_method_type text, p_method_name text, p_account_number text, p_account_holder_name text, p_bank_name text, p_is_active boolean, p_display_order integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_payment_method(p_id uuid, p_method_type text, p_method_name text, p_account_number text, p_account_holder_name text, p_bank_name text, p_is_active boolean, p_display_order integer) IS 'Admin: Update an existing payment method';


--
-- Name: update_payment_method_internal(uuid, text, text, text, text, text, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_payment_method_internal(p_id uuid, p_method_type text DEFAULT NULL::text, p_method_name text DEFAULT NULL::text, p_account_number text DEFAULT NULL::text, p_account_holder_name text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_display_order integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE id = p_id) THEN
        RETURN json_build_object('success', false, 'error', 'Payment method not found');
    END IF;
    
    UPDATE payment_methods SET
        method_type = COALESCE(p_method_type, method_type),
        method_name = COALESCE(p_method_name, method_name),
        account_number = COALESCE(p_account_number, account_number),
        account_holder_name = COALESCE(p_account_holder_name, account_holder_name),
        bank_name = COALESCE(p_bank_name, bank_name),
        is_active = COALESCE(p_is_active, is_active),
        display_order = COALESCE(p_display_order, display_order),
        updated_at = NOW()
    WHERE id = p_id;
    
    RETURN json_build_object('success', true, 'message', 'Payment method updated');
END;
$$;


--
-- Name: update_payslip_advanced(uuid, text, text, numeric, numeric, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_payslip_advanced(p_payslip_id uuid, p_status text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_bonuses numeric DEFAULT NULL::numeric, p_deductions numeric DEFAULT NULL::numeric, p_tax_amount numeric DEFAULT NULL::numeric, p_overtime_hours numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_payslip RECORD;
    v_net_salary DECIMAL;
    v_overtime_pay DECIMAL;
    v_bonuses DECIMAL;
    v_deductions DECIMAL;
    v_tax DECIMAL;
    v_overtime DECIMAL;
BEGIN
    -- Get existing payslip
    SELECT * INTO v_payslip FROM payslips WHERE id = p_payslip_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Payslip not found');
    END IF;

    -- Use new values or existing
    v_bonuses := COALESCE(p_bonuses, v_payslip.bonuses);
    v_deductions := COALESCE(p_deductions, v_payslip.deductions);
    v_tax := COALESCE(p_tax_amount, v_payslip.tax_amount);
    v_overtime := COALESCE(p_overtime_hours, v_payslip.overtime_hours);

    -- Recalculate net salary
    v_overtime_pay := (v_payslip.base_salary / 30.0 / 8.0) * v_overtime * v_payslip.overtime_rate;
    v_net_salary := v_payslip.base_salary + v_overtime_pay + v_bonuses - v_deductions - v_tax;

    UPDATE payslips
    SET 
        status = COALESCE(p_status, status),
        payment_method = COALESCE(p_payment_method, payment_method),
        bonuses = v_bonuses,
        deductions = v_deductions,
        tax_amount = v_tax,
        overtime_hours = v_overtime,
        net_salary = v_net_salary,
        notes = COALESCE(p_notes, notes),
        paid_at = CASE 
            WHEN p_status = 'paid' AND paid_at IS NULL THEN NOW() 
            ELSE paid_at 
        END,
        updated_at = NOW()
    WHERE id = p_payslip_id;
    
    RETURN json_build_object('success', true, 'net_salary', v_net_salary);
END;
$$;


--
-- Name: update_payslip_status(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_payslip_status(p_payslip_id uuid, p_status text, p_payment_method text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE payslips
    SET 
        status = p_status,
        payment_method = COALESCE(p_payment_method, payment_method),
        paid_at = CASE WHEN p_status = 'paid' THEN NOW() ELSE paid_at END,
        updated_at = NOW()
    WHERE id = p_payslip_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: update_perks_setting(text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_perks_setting(p_setting_key text, p_setting_value jsonb, p_description text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_emp_id UUID;
BEGIN
    -- Get employee ID for audit
    v_emp_id := (auth.jwt() -> 'user_metadata' ->> 'employee_id')::UUID;
    
    UPDATE perks_settings
    SET 
        setting_value = p_setting_value,
        description = COALESCE(p_description, description),
        updated_by = v_emp_id,
        updated_at = NOW()
    WHERE setting_key = p_setting_key;
    
    IF NOT FOUND THEN
        INSERT INTO perks_settings (setting_key, setting_value, description, updated_by)
        VALUES (p_setting_key, p_setting_value, p_description, v_emp_id);
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'setting_key', p_setting_key,
        'message', 'Setting updated successfully'
    );
END;
$$;


--
-- Name: update_review_visibility(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_review_visibility(p_review_id uuid, p_is_visible boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: update_review_visibility_by_employee(uuid, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_review_visibility_by_employee(p_review_id uuid, p_is_visible boolean, p_employee_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Check if employee exists and is manager or admin
    SELECT role INTO v_role 
    FROM employees 
    WHERE id = p_employee_id 
    AND status = 'active';
    
    IF v_role IS NULL OR v_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: update_site_content_section(text, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_site_content_section(p_section text, p_content jsonb, p_is_active boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    INSERT INTO site_content (section, content, is_active)
    VALUES (p_section, p_content, p_is_active)
    ON CONFLICT (section) 
    DO UPDATE SET 
        content = EXCLUDED.content,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    RETURNING jsonb_build_object(
        'section', section,
        'content', content,
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


--
-- Name: update_table_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_status(p_table_id uuid, p_status text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF NOT is_manager_or_admin() AND NOT can_take_orders() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE restaurant_tables
    SET status = p_status::table_status,
        updated_at = NOW()
    WHERE id = p_table_id;
    
    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_user_password(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_password(p_email text, p_new_password text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_auth_user_id_text TEXT;
  v_auth_user_id UUID;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Get auth_user_id (check customers first, then employees)
  SELECT c.auth_user_id INTO v_auth_user_id_text
  FROM public.customers c
  WHERE c.email = p_email;
  
  IF v_auth_user_id_text IS NULL THEN
    SELECT e.auth_user_id INTO v_auth_user_id_text
    FROM public.employees e
    WHERE e.email = p_email;
  END IF;
  
  IF v_auth_user_id_text IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Account not found with this email');
  END IF;
  
  -- Cast to UUID
  BEGIN
    v_auth_user_id := v_auth_user_id_text::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Invalid auth user ID format');
  END;
  
  -- Update password directly in Supabase auth.users
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id::text = v_auth_user_id::text;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Auth user not found');
  END IF;
  
  -- Clear sessions (force re-login)
  DELETE FROM auth.sessions WHERE user_id::text = v_auth_user_id::text;
  DELETE FROM auth.refresh_tokens WHERE user_id::text = v_auth_user_id::text;
  
  RETURN json_build_object('success', true);
END;
$$;


--
-- Name: FUNCTION update_user_password(p_email text, p_new_password text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_user_password(p_email text, p_new_password text) IS 'Updates password in Supabase auth.users after OTP verification';


--
-- Name: upsert_website_settings_internal(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_website_settings_internal(p_settings jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO website_content (key, title, content, section, is_active, updated_at)
    VALUES ('settings', 'Website Settings', p_settings, 'general', true, NOW())
    ON CONFLICT (key) DO UPDATE SET
        content = p_settings,
        updated_at = NOW();
    
    RETURN json_build_object('success', true, 'message', 'Settings saved');
END;
$$;


--
-- Name: use_customer_promo_code(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.use_customer_promo_code(p_code text, p_customer_id uuid, p_order_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_promo RECORD;
    v_promo_code TEXT;
BEGIN
    v_promo_code := UPPER(TRIM(p_code));
    
    -- Find the customer promo code (check if not already used)
    SELECT * INTO v_promo
    FROM customer_promo_codes
    WHERE code = v_promo_code
    AND customer_id = p_customer_id
    AND is_used = false;
    
    IF v_promo IS NULL THEN
        -- Check if it exists but is already used
        IF EXISTS (SELECT 1 FROM customer_promo_codes WHERE code = v_promo_code AND customer_id = p_customer_id AND is_used = true) THEN
            RETURN json_build_object('success', false, 'error', 'This promo code has already been used');
        END IF;
        -- Check if expired
        IF EXISTS (SELECT 1 FROM customer_promo_codes WHERE code = v_promo_code AND customer_id = p_customer_id AND expires_at < NOW()) THEN
            RETURN json_build_object('success', false, 'error', 'This promo code has expired');
        END IF;
        RETURN json_build_object('success', false, 'error', 'Promo code not found or does not belong to this customer');
    END IF;
    
    -- Check if expired
    IF v_promo.expires_at < NOW() THEN
        RETURN json_build_object('success', false, 'error', 'This promo code has expired');
    END IF;
    
    -- Mark as USED in customer_promo_codes table
    UPDATE customer_promo_codes
    SET 
        is_used = true, 
        used_at = NOW(), 
        used_on_order_id = p_order_id, 
        is_active = false
    WHERE id = v_promo.id;
    
    -- Mark as USED in main promo_codes table
    UPDATE promo_codes
    SET 
        current_usage = COALESCE(usage_limit, 1),  -- Set to max usage
        is_active = false, 
        updated_at = NOW()
    WHERE code = v_promo_code;
    
    RAISE NOTICE 'Promo code % marked as USED for customer % on order %', v_promo_code, p_customer_id, p_order_id;
    
    RETURN json_build_object(
        'success', true,
        'promo_type', v_promo.promo_type,
        'value', v_promo.value,
        'max_discount', v_promo.max_discount,
        'code', v_promo_code,
        'message', 'Promo code applied successfully'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error using promo code: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: validate_employee_license(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_employee_license(p_email text, p_license_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_employee RECORD;
    v_license RECORD;
BEGIN
    -- Normalize email
    p_email := LOWER(TRIM(p_email));
    p_license_id := UPPER(TRIM(p_license_id));
    
    -- Find employee by email (case insensitive)
    SELECT id, name, email, role, status, portal_enabled, auth_user_id
    INTO v_employee
    FROM employees
    WHERE LOWER(email) = p_email;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'No employee found with this email address'
        );
    END IF;
    
    -- Check if already active
    IF v_employee.status = 'active' AND v_employee.portal_enabled AND v_employee.auth_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'This account is already activated. Please use login instead.',
            'already_active', TRUE
        );
    END IF;
    
    -- Find license for this employee
    SELECT *
    INTO v_license
    FROM employee_licenses
    WHERE employee_id = v_employee.id
      AND license_id = p_license_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid license ID for this employee'
        );
    END IF;
    
    -- Check if license is already used
    IF v_license.is_used THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'This license ID has already been used'
        );
    END IF;
    
    -- Check if license is expired
    IF v_license.expires_at < NOW() THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'License ID has expired. Please contact admin for a new one.'
        );
    END IF;
    
    -- Valid - return employee info
    RETURN jsonb_build_object(
        'success', TRUE,
        'employee', jsonb_build_object(
            'id', v_employee.id,
            'name', v_employee.name,
            'email', v_employee.email,
            'role', v_employee.role::TEXT
        ),
        'license', jsonb_build_object(
            'id', v_license.id,
            'license_id', v_license.license_id,
            'expires_at', v_license.expires_at
        )
    );
END;
$$;


--
-- Name: validate_password_reset_session(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_password_reset_session(p_email text, p_token text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_otp_record RECORD;
  v_result JSON;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Get the most recent verified OTP for this email
  SELECT *
  INTO v_otp_record
  FROM public.password_reset_otps
  WHERE email = p_email
    AND is_verified = true
    AND expires_at > NOW()
  ORDER BY verified_at DESC
  LIMIT 1;
  
  -- Check if valid session exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'No valid session found'
    );
  END IF;
  
  -- Return validation result
  RETURN json_build_object(
    'valid', true,
    'email', v_otp_record.email,
    'verified_at', v_otp_record.verified_at,
    'expires_at', v_otp_record.expires_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Session validation failed'
    );
END;
$$;


--
-- Name: FUNCTION validate_password_reset_session(p_email text, p_token text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_password_reset_session(p_email text, p_token text) IS 'Validates password reset session from database';


--
-- Name: validate_promo_code(text, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_promo_code(p_code text, p_customer_id uuid DEFAULT NULL::uuid, p_order_amount numeric DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_promo RECORD;
    v_discount DECIMAL;
BEGIN
    -- Find the promo code
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code)
      AND is_active = true
      AND (valid_from IS NULL OR valid_from <= NOW())
      AND (valid_until IS NULL OR valid_until > NOW())
      AND (usage_limit IS NULL OR current_usage < usage_limit)
      -- Check customer-specific codes belong to the right customer
      AND (customer_id IS NULL OR customer_id = p_customer_id)
    LIMIT 1;

    IF v_promo IS NULL THEN
        -- Check if code exists but is invalid
        IF EXISTS (SELECT 1 FROM promo_codes WHERE UPPER(code) = UPPER(p_code)) THEN
            RETURN json_build_object(
                'valid', false,
                'error', 'Promo code is expired, used, or not available for your account'
            );
        END IF;
        
        RETURN json_build_object('valid', false, 'error', 'Invalid promo code');
    END IF;

    -- Check minimum order amount
    IF v_promo.min_order_amount IS NOT NULL AND p_order_amount < v_promo.min_order_amount THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Minimum order amount of Rs. ' || v_promo.min_order_amount || ' required'
        );
    END IF;

    -- Calculate discount
    IF v_promo.promo_type = 'percentage' THEN
        v_discount := ROUND((p_order_amount * v_promo.value / 100)::DECIMAL, 2);
        IF v_promo.max_discount IS NOT NULL AND v_discount > v_promo.max_discount THEN
            v_discount := v_promo.max_discount;
        END IF;
    ELSE
        v_discount := v_promo.value;
    END IF;

    RETURN json_build_object(
        'valid', true,
        'promo', json_build_object(
            'id', v_promo.id,
            'code', v_promo.code,
            'name', v_promo.name,
            'promo_type', v_promo.promo_type,
            'value', v_promo.value,
            'discount_amount', v_discount
        ),
        'discount_amount', v_discount
    );
END;
$$;


--
-- Name: validate_promo_code_for_billing(text, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_promo_code_for_billing(p_code text, p_customer_id uuid DEFAULT NULL::uuid, p_order_amount numeric DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_promo RECORD;
    v_usage_count INT;
    v_discount_value DECIMAL(10, 2);
    v_customer_usage INT;
BEGIN
    -- Find promo code
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE UPPER(code) = UPPER(p_code)
    AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'valid', false, 
            'error', 'Promo code not found',
            'error_code', 'NOT_FOUND'
        );
    END IF;
    
    -- Check if code is expired
    IF v_promo.valid_from > NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Promo code is not yet active',
            'error_code', 'NOT_ACTIVE_YET',
            'valid_from', v_promo.valid_from
        );
    END IF;
    
    IF v_promo.valid_until < NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Promo code has expired',
            'error_code', 'EXPIRED',
            'expired_at', v_promo.valid_until
        );
    END IF;
    
    -- Check global usage limit
    IF v_promo.usage_limit IS NOT NULL AND v_promo.current_usage >= v_promo.usage_limit THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Promo code usage limit reached',
            'error_code', 'LIMIT_REACHED',
            'usage_limit', v_promo.usage_limit,
            'current_usage', v_promo.current_usage
        );
    END IF;
    
    -- Check customer-specific usage if customer provided
    IF p_customer_id IS NOT NULL THEN
        -- Check if promo is customer-specific
        IF v_promo.customer_id IS NOT NULL AND v_promo.customer_id != p_customer_id THEN
            RETURN json_build_object(
                'valid', false,
                'error', 'This promo code is not for this customer',
                'error_code', 'CUSTOMER_MISMATCH'
            );
        END IF;
        
        -- Check per-customer usage limit
        IF v_promo.usage_per_customer IS NOT NULL THEN
            SELECT COUNT(*) INTO v_customer_usage
            FROM invoices i
            WHERE i.customer_id = p_customer_id
            AND i.promo_code_id = v_promo.id;
            
            IF v_customer_usage >= v_promo.usage_per_customer THEN
                RETURN json_build_object(
                    'valid', false,
                    'error', 'You have already used this promo code maximum times',
                    'error_code', 'CUSTOMER_LIMIT_REACHED',
                    'usage_per_customer', v_promo.usage_per_customer,
                    'customer_usage', v_customer_usage
                );
            END IF;
        END IF;
    END IF;
    
    -- Check minimum order amount
    IF v_promo.min_order_amount IS NOT NULL AND p_order_amount < v_promo.min_order_amount THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Minimum order amount of Rs. ' || v_promo.min_order_amount || ' required',
            'error_code', 'MIN_ORDER_NOT_MET',
            'min_order_amount', v_promo.min_order_amount,
            'current_amount', p_order_amount
        );
    END IF;
    
    -- Calculate discount
    IF v_promo.promo_type = 'percentage' THEN
        v_discount_value := ROUND(p_order_amount * (v_promo.value / 100), 2);
        IF v_promo.max_discount IS NOT NULL THEN
            v_discount_value := LEAST(v_discount_value, v_promo.max_discount);
        END IF;
    ELSIF v_promo.promo_type = 'fixed_amount' THEN
        v_discount_value := LEAST(v_promo.value, p_order_amount);
    ELSE
        v_discount_value := 0;
    END IF;
    
    -- Return success with promo details
    RETURN json_build_object(
        'valid', true,
        'promo', json_build_object(
            'id', v_promo.id,
            'code', v_promo.code,
            'name', v_promo.name,
            'description', v_promo.description,
            'promo_type', v_promo.promo_type,
            'value', v_promo.value,
            'discount_amount', v_discount_value,
            'max_discount', v_promo.max_discount,
            'min_order_amount', v_promo.min_order_amount,
            'usage_left', CASE WHEN v_promo.usage_limit IS NOT NULL 
                          THEN v_promo.usage_limit - v_promo.current_usage 
                          ELSE NULL END
        ),
        'discount_amount', v_discount_value
    );
END;
$$;


--
-- Name: FUNCTION validate_promo_code_for_billing(p_code text, p_customer_id uuid, p_order_amount numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_promo_code_for_billing(p_code text, p_customer_id uuid, p_order_amount numeric) IS 'Comprehensive promo code validation';


--
-- Name: verify_employee_document(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_employee_document(p_document_id uuid, p_verified_by uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE employee_documents SET
    verified = true,
    verified_by = p_verified_by,
    verified_at = NOW()
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Document verified');
END;
$$;


--
-- Name: verify_employee_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_employee_id(emp_id text) RETURNS TABLE(id uuid, employee_id text, email text, role public.user_role, is_verified boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.employee_id, e.email, e.role, e.is_verified
    FROM employees e
    WHERE e.employee_id = emp_id AND e.status = 'pending';
END;
$$;


--
-- Name: void_invoice(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.void_invoice(p_invoice_id uuid, p_reason text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_employee_id UUID;
    v_invoice RECORD;
BEGIN
    -- Try to get employee ID (fallback if auth_user_id not set)
    v_employee_id := (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
    IF v_employee_id IS NULL THEN
        v_employee_id := (SELECT id FROM employees WHERE role::TEXT IN ('admin', 'manager') AND status = 'active' LIMIT 1);
    END IF;
    
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
    
    IF v_invoice IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invoice not found');
    END IF;
    
    IF v_invoice.bill_status = 'void' THEN
        RETURN json_build_object('success', false, 'error', 'Invoice is already voided');
    END IF;
    
    UPDATE invoices
    SET bill_status = 'void',
        payment_status = 'refunded',
        void_reason = p_reason,
        voided_by = v_employee_id,
        voided_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    -- Log audit
    INSERT INTO audit_logs (action, entity_type, entity_id, performed_by, details)
    VALUES ('void_invoice', 'invoice', p_invoice_id, v_employee_id, 
            json_build_object('reason', p_reason, 'invoice_number', v_invoice.invoice_number));
    
    RETURN json_build_object(
        'success', true,
        'message', 'Invoice voided successfully',
        'invoice_number', v_invoice.invoice_number
    );
END;
$$;


--
-- Name: FUNCTION void_invoice(p_invoice_id uuid, p_reason text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.void_invoice(p_invoice_id uuid, p_reason text) IS 'Voids an invoice with reason';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    date date NOT NULL,
    check_in timestamp with time zone,
    check_out timestamp with time zone,
    break_start timestamp with time zone,
    break_end timestamp with time zone,
    status character varying(50) DEFAULT 'present'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: attendance_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_codes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code character varying(10) NOT NULL,
    generated_by uuid,
    valid_for_date date NOT NULL,
    valid_from time without time zone NOT NULL,
    valid_until time without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    user_type character varying(50),
    action character varying(100) NOT NULL,
    table_name character varying(100),
    record_id uuid,
    old_data jsonb,
    new_data jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    subject character varying(255),
    message text NOT NULL,
    status character varying(50) DEFAULT 'unread'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    ip_address inet,
    user_agent text,
    reply_message text,
    replied_by uuid,
    replied_at timestamp with time zone,
    reply_sent_via character varying(20) DEFAULT 'email'::character varying,
    customer_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contact_messages_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT contact_messages_reply_sent_via_check CHECK (((reply_sent_via)::text = ANY ((ARRAY['email'::character varying, 'phone'::character varying, 'both'::character varying])::text[]))),
    CONSTRAINT contact_messages_status_check CHECK (((status)::text = ANY ((ARRAY['unread'::character varying, 'read'::character varying, 'replied'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: customer_invoice_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_invoice_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    invoice_number text NOT NULL,
    order_id uuid,
    order_type text,
    items jsonb,
    subtotal numeric(10,2),
    discount numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    payment_method text,
    payment_status text,
    promo_code_used text,
    loyalty_points_used integer DEFAULT 0,
    loyalty_points_earned integer DEFAULT 0,
    billed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    auth_user_id uuid,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    address text,
    is_verified boolean DEFAULT false,
    is_2fa_enabled boolean DEFAULT false,
    two_fa_secret text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    favorites jsonb DEFAULT '[]'::jsonb,
    is_banned boolean DEFAULT false,
    ban_reason text,
    banned_at timestamp with time zone,
    banned_by uuid,
    unbanned_at timestamp with time zone,
    unbanned_by uuid
);


--
-- Name: loyalty_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_points (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    customer_id uuid,
    order_id uuid,
    points integer NOT NULL,
    type character varying(20) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT loyalty_points_type_check CHECK (((type)::text = ANY ((ARRAY['earned'::character varying, 'redeemed'::character varying, 'bonus'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: customer_loyalty_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_loyalty_summary AS
 SELECT c.id AS customer_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.email AS customer_email,
    COALESCE(sum(lp.points), (0)::bigint) AS total_points,
    COALESCE(sum(
        CASE
            WHEN ((lp.type)::text = 'earned'::text) THEN lp.points
            ELSE 0
        END), (0)::bigint) AS earned_points,
    COALESCE(sum(
        CASE
            WHEN ((lp.type)::text = 'redeemed'::text) THEN abs(lp.points)
            ELSE 0
        END), (0)::bigint) AS redeemed_points,
    COALESCE(sum(
        CASE
            WHEN ((lp.type)::text = 'bonus'::text) THEN lp.points
            ELSE 0
        END), (0)::bigint) AS bonus_points,
    count(DISTINCT lp.order_id) AS orders_with_points,
    max(lp.created_at) AS last_points_activity
   FROM (public.customers c
     LEFT JOIN public.loyalty_points lp ON ((lp.customer_id = c.id)))
  GROUP BY c.id, c.name, c.phone, c.email;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    order_number character varying(50) NOT NULL,
    customer_id uuid,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_phone character varying(20) NOT NULL,
    customer_address text,
    order_type public.order_type DEFAULT 'online'::public.order_type,
    items jsonb NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    delivery_fee numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    status public.order_status DEFAULT 'pending'::public.order_status,
    notes text,
    table_number integer,
    assigned_to uuid,
    prepared_by uuid,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    payment_proof_url text,
    waiter_id uuid,
    kitchen_started_at timestamp with time zone,
    kitchen_completed_at timestamp with time zone,
    can_cancel_until timestamp with time zone,
    cancellation_reason text,
    delivery_rider_id uuid,
    delivery_started_at timestamp with time zone,
    estimated_delivery_time timestamp with time zone,
    customer_notified boolean DEFAULT false,
    transaction_id text,
    online_payment_method_id uuid,
    online_payment_details jsonb
);


--
-- Name: COLUMN orders.transaction_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.transaction_id IS 'Transaction/Reference ID provided by customer for online payments';


--
-- Name: COLUMN orders.online_payment_method_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.online_payment_method_id IS 'Reference to the payment method used (JazzCash, EasyPaisa, Bank)';


--
-- Name: COLUMN orders.online_payment_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.online_payment_details IS 'Additional payment details stored as JSON (method name, account details shown, etc.)';


--
-- Name: customer_order_history; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_order_history WITH (security_invoker='true') AS
 SELECT c.id AS customer_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.email AS customer_email,
    count(o.id) AS total_orders,
    sum(o.total) AS total_spent,
    max(o.created_at) AS last_order_date,
    min(o.created_at) AS first_order_date,
    COALESCE(( SELECT sum(
                CASE
                    WHEN ((lp.type)::text = ANY ((ARRAY['earned'::character varying, 'bonus'::character varying])::text[])) THEN lp.points
                    ELSE (- lp.points)
                END) AS sum
           FROM public.loyalty_points lp
          WHERE (lp.customer_id = c.id)), (0)::bigint) AS loyalty_points,
        CASE
            WHEN (COALESCE(( SELECT sum(
                    CASE
                        WHEN ((lp.type)::text = ANY ((ARRAY['earned'::character varying, 'bonus'::character varying])::text[])) THEN lp.points
                        ELSE (- lp.points)
                    END) AS sum
               FROM public.loyalty_points lp
              WHERE (lp.customer_id = c.id)), (0)::bigint) >= 5000) THEN 'platinum'::text
            WHEN (COALESCE(( SELECT sum(
                    CASE
                        WHEN ((lp.type)::text = ANY ((ARRAY['earned'::character varying, 'bonus'::character varying])::text[])) THEN lp.points
                        ELSE (- lp.points)
                    END) AS sum
               FROM public.loyalty_points lp
              WHERE (lp.customer_id = c.id)), (0)::bigint) >= 2000) THEN 'gold'::text
            WHEN (COALESCE(( SELECT sum(
                    CASE
                        WHEN ((lp.type)::text = ANY ((ARRAY['earned'::character varying, 'bonus'::character varying])::text[])) THEN lp.points
                        ELSE (- lp.points)
                    END) AS sum
               FROM public.loyalty_points lp
              WHERE (lp.customer_id = c.id)), (0)::bigint) >= 500) THEN 'silver'::text
            ELSE 'bronze'::text
        END AS loyalty_tier
   FROM (public.customers c
     LEFT JOIN public.orders o ON ((o.customer_id = c.id)))
  GROUP BY c.id, c.name, c.phone, c.email;


--
-- Name: VIEW customer_order_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.customer_order_history IS 'Aggregated customer order history with loyalty information';


--
-- Name: customer_promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_promo_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    promo_code_id uuid,
    code text NOT NULL,
    promo_type text NOT NULL,
    value numeric(10,2) NOT NULL,
    max_discount numeric(10,2),
    name text NOT NULL,
    description text,
    loyalty_points_required integer NOT NULL,
    is_used boolean DEFAULT false,
    used_at timestamp with time zone,
    used_on_order_id uuid,
    expires_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT customer_promo_codes_promo_type_check CHECK ((promo_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text])))
);


--
-- Name: deal_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deal_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    deal_id uuid NOT NULL,
    menu_item_id uuid NOT NULL,
    quantity integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    discount_percentage numeric(5,2),
    discount_amount numeric(10,2),
    images jsonb DEFAULT '[]'::jsonb,
    applicable_items jsonb,
    minimum_order_amount numeric(10,2),
    is_active boolean DEFAULT true,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    usage_limit integer,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    code character varying(50),
    deal_type character varying(50) DEFAULT 'combo'::character varying,
    original_price numeric(10,2) DEFAULT 0,
    discounted_price numeric(10,2) DEFAULT 0,
    image_url text,
    is_featured boolean DEFAULT false
);


--
-- Name: delivery_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rider_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_number text NOT NULL,
    order_snapshot jsonb NOT NULL,
    customer_name text NOT NULL,
    customer_phone text,
    customer_address text,
    customer_email text,
    items jsonb NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    payment_method text,
    payment_status text,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    delivered_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    delivery_status text DEFAULT 'accepted'::text NOT NULL,
    estimated_delivery_minutes integer,
    actual_delivery_minutes integer,
    distance_km numeric(6,2),
    delivery_notes text,
    customer_rating integer,
    customer_feedback text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_history_customer_rating_check CHECK (((customer_rating >= 1) AND (customer_rating <= 5))),
    CONSTRAINT delivery_history_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['accepted'::text, 'delivering'::text, 'delivered'::text, 'cancelled'::text, 'returned'::text])))
);


--
-- Name: TABLE delivery_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.delivery_history IS 'Stores delivery history per rider with complete order snapshots for analytics and isolation';


--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_documents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    document_type character varying(100) NOT NULL,
    document_name character varying(255) NOT NULL,
    file_url text NOT NULL,
    file_type character varying(50),
    uploaded_at timestamp with time zone DEFAULT now(),
    verified boolean DEFAULT false,
    verified_by uuid,
    verified_at timestamp with time zone
);


--
-- Name: employee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_licenses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    license_id character varying(50) NOT NULL,
    issued_at timestamp with time zone DEFAULT now(),
    activated_at timestamp with time zone,
    activation_ip inet,
    is_used boolean DEFAULT false,
    expires_at timestamp with time zone
);


--
-- Name: employee_payroll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_payroll (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    month integer NOT NULL,
    year integer NOT NULL,
    base_salary numeric(10,2) NOT NULL,
    bonus numeric(10,2) DEFAULT 0,
    deductions numeric(10,2) DEFAULT 0,
    tips numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) NOT NULL,
    paid boolean DEFAULT false,
    paid_at timestamp with time zone,
    paid_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    payment_frequency text DEFAULT 'monthly'::text,
    bank_details jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT employee_payroll_payment_frequency_check CHECK ((payment_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text])))
);


--
-- Name: COLUMN employee_payroll.payment_frequency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.employee_payroll.payment_frequency IS 'Payment frequency: daily, weekly, biweekly, monthly, quarterly, yearly';


--
-- Name: COLUMN employee_payroll.bank_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.employee_payroll.bank_details IS 'Bank account details stored as JSON (account_number, bank_name, branch, etc.)';


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    auth_user_id uuid,
    employee_id character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    role public.user_role NOT NULL,
    status public.employee_status DEFAULT 'pending'::public.employee_status,
    permissions jsonb DEFAULT '{}'::jsonb,
    documents jsonb DEFAULT '[]'::jsonb,
    salary numeric(10,2),
    hired_date date,
    created_by uuid,
    is_2fa_enabled boolean DEFAULT false,
    two_fa_secret text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    license_id character varying(50),
    avatar_url text,
    address text,
    emergency_contact character varying(20),
    emergency_contact_name character varying(255),
    date_of_birth date,
    blood_group character varying(10),
    portal_enabled boolean DEFAULT false,
    last_login timestamp with time zone,
    total_tips numeric(10,2) DEFAULT 0,
    total_orders_taken integer DEFAULT 0,
    bank_details jsonb DEFAULT '{}'::jsonb,
    notes text,
    block_reason text
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    quantity numeric(10,2) DEFAULT 0 NOT NULL,
    unit character varying(50) NOT NULL,
    min_quantity numeric(10,2) DEFAULT 0 NOT NULL,
    cost_per_unit numeric(10,2) DEFAULT 0 NOT NULL,
    supplier character varying(255),
    last_restocked timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    sku character varying(100),
    max_quantity numeric(10,2) DEFAULT 100,
    notes text,
    created_by uuid,
    location character varying(255),
    barcode character varying(100),
    expiry_date date,
    is_active boolean DEFAULT true,
    reorder_point numeric(10,2) DEFAULT 10,
    lead_time_days integer DEFAULT 7
);


--
-- Name: inventory_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_id uuid,
    alert_type character varying(50) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    is_resolved boolean DEFAULT false,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inventory_alerts_alert_type_check CHECK (((alert_type)::text = ANY ((ARRAY['low_stock'::character varying, 'out_of_stock'::character varying, 'expiring'::character varying, 'expired'::character varying, 'overstock'::character varying])::text[])))
);


--
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    parent_id uuid,
    color character varying(20),
    icon character varying(50),
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number character varying(50) NOT NULL,
    supplier_id uuid,
    supplier_name character varying(255),
    status character varying(50) DEFAULT 'draft'::character varying,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    shipping numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0,
    expected_date date,
    received_date date,
    notes text,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inventory_purchase_orders_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'approved'::character varying, 'ordered'::character varying, 'partial'::character varying, 'received'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: inventory_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    contact_person character varying(255),
    email character varying(255),
    phone character varying(50),
    address text,
    city character varying(100),
    payment_terms character varying(255),
    lead_time_days integer DEFAULT 7,
    rating numeric(2,1),
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    inventory_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    quantity numeric(10,2) NOT NULL,
    previous_quantity numeric(10,2) NOT NULL,
    new_quantity numeric(10,2) NOT NULL,
    reason text,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    transaction_type character varying(50),
    quantity_change numeric(10,2),
    unit_cost numeric(10,2),
    total_cost numeric(10,2),
    notes text,
    created_by uuid,
    reference_number character varying(100),
    batch_number character varying(100)
);


--
-- Name: invoice_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    invoice_number character varying(50) NOT NULL,
    order_id uuid,
    customer_id uuid,
    customer_name character varying(255) NOT NULL,
    customer_phone character varying(20),
    customer_email character varying(255),
    order_type character varying(50) NOT NULL,
    items jsonb NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    discount_details jsonb,
    tax numeric(10,2) DEFAULT 0,
    delivery_fee numeric(10,2) DEFAULT 0,
    service_charge numeric(10,2) DEFAULT 0,
    tip numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    payment_method character varying(50),
    payment_status public.invoice_status DEFAULT 'pending'::public.invoice_status,
    loyalty_points_earned integer DEFAULT 0,
    table_number integer,
    served_by uuid,
    billed_by uuid,
    printed boolean DEFAULT false,
    printed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    bill_status text DEFAULT 'pending'::text,
    promo_code_id uuid,
    promo_code_value text,
    void_reason text,
    voided_by uuid,
    voided_at timestamp with time zone,
    table_session_id uuid,
    brand_info jsonb DEFAULT '{"ntn": "XXXXXXX", "name": "ZOIRO Broast", "email": "info@zoiro.com", "phone": "+92 XXX XXXXXXX", "address": "Main Branch, City", "tagline": "Injected Broast - Saucy. Juicy. Crispy.", "logo_url": "/assets/logo.png"}'::jsonb,
    loyalty_points_used integer DEFAULT 0,
    CONSTRAINT invoices_bill_status_check CHECK ((bill_status = ANY (ARRAY['pending'::text, 'generated'::text, 'paid'::text, 'void'::text, 'refunded'::text])))
);


--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_balances (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    annual_leave integer DEFAULT 14,
    sick_leave integer DEFAULT 10,
    casual_leave integer DEFAULT 5,
    annual_used integer DEFAULT 0,
    sick_used integer DEFAULT 0,
    casual_used integer DEFAULT 0,
    year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days integer NOT NULL,
    reason text NOT NULL,
    status character varying DEFAULT 'pending'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT leave_requests_leave_type_check CHECK (((leave_type)::text = ANY ((ARRAY['annual'::character varying, 'sick'::character varying, 'casual'::character varying, 'emergency'::character varying, 'unpaid'::character varying, 'maternity'::character varying, 'paternity'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT leave_requests_valid_dates CHECK ((end_date >= start_date))
);


--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    customer_id uuid,
    points_change integer NOT NULL,
    transaction_type character varying(50) NOT NULL,
    order_id uuid,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: maintenance_mode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_mode (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    reason_type text DEFAULT 'update'::text NOT NULL,
    custom_reason text,
    title text DEFAULT 'We''ll Be Right Back'::text,
    message text DEFAULT 'Our website is currently undergoing scheduled maintenance. We apologize for any inconvenience.'::text,
    estimated_restore_time timestamp with time zone,
    show_timer boolean DEFAULT true,
    show_progress boolean DEFAULT true,
    enabled_at timestamp with time zone,
    enabled_by uuid,
    email_sent_at timestamp with time zone,
    email_sent_count integer DEFAULT 0,
    last_check timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT maintenance_mode_reason_type_check CHECK ((reason_type = ANY (ARRAY['update'::text, 'bug_fix'::text, 'changes'::text, 'scheduled'::text, 'custom'::text])))
);


--
-- Name: TABLE maintenance_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.maintenance_mode IS 'Single-row table storing maintenance mode settings';


--
-- Name: meals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    original_price numeric(10,2),
    images jsonb DEFAULT '[]'::jsonb,
    items jsonb NOT NULL,
    is_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    rating numeric(2,1) DEFAULT 0,
    total_reviews integer DEFAULT 0
);


--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_categories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    image_url text,
    display_order integer DEFAULT 0,
    is_visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    category_id uuid,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    images jsonb DEFAULT '[]'::jsonb,
    is_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    preparation_time integer,
    rating numeric(3,2) DEFAULT 0,
    total_reviews integer DEFAULT 0,
    tags jsonb DEFAULT '[]'::jsonb,
    nutritional_info jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    size_variants jsonb,
    has_variants boolean DEFAULT false
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    user_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50),
    is_read boolean DEFAULT false,
    data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    priority character varying(20) DEFAULT 'normal'::character varying,
    action_url text,
    expires_at timestamp with time zone,
    sent_by uuid
);


--
-- Name: order_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    action text NOT NULL,
    action_by uuid,
    action_by_name text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_cancellations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_cancellations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    order_id uuid,
    cancelled_by uuid,
    reason text,
    refund_amount numeric(10,2),
    refund_status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    order_id uuid,
    status public.order_status NOT NULL,
    changed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_codes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    code character varying(6) NOT NULL,
    purpose character varying(50) NOT NULL,
    is_used boolean DEFAULT false,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: password_reset_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying NOT NULL,
    otp_hash character varying NOT NULL,
    purpose character varying DEFAULT 'password_reset'::character varying,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    is_verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE password_reset_otps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.password_reset_otps IS 'Stores password reset OTPs (primary storage in Redis, this is for audit)';


--
-- Name: password_reset_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying NOT NULL,
    attempt_count integer DEFAULT 1,
    first_attempt_at timestamp with time zone DEFAULT now(),
    last_attempt_at timestamp with time zone DEFAULT now(),
    cooldown_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE password_reset_rate_limits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.password_reset_rate_limits IS 'Tracks rate limits for password reset attempts';


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    method_type text NOT NULL,
    method_name text NOT NULL,
    account_number text NOT NULL,
    account_holder_name text NOT NULL,
    bank_name text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_methods_method_type_check CHECK ((method_type = ANY (ARRAY['jazzcash'::text, 'easypaisa'::text, 'bank'::text])))
);


--
-- Name: TABLE payment_methods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_methods IS 'Stores online payment method details (JazzCash, EasyPaisa, Bank accounts) configured by admin';


--
-- Name: payment_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_records (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    proof_url text,
    transaction_id text,
    verified_by uuid,
    verified_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payslips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payslips (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    base_salary numeric(10,2) NOT NULL,
    overtime_hours numeric(5,2) DEFAULT 0,
    overtime_rate numeric(10,2) DEFAULT 1.5,
    bonuses numeric(10,2) DEFAULT 0,
    deductions numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    net_salary numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    payment_method character varying(50),
    paid_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: perks_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perks_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value jsonb NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: promo_code_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_code_usage (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    deal_id uuid NOT NULL,
    order_id uuid NOT NULL,
    discount_applied numeric(10,2) NOT NULL,
    used_at timestamp with time zone DEFAULT now()
);


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    promo_type public.promo_type NOT NULL,
    value numeric(10,2) NOT NULL,
    min_order_amount numeric(10,2) DEFAULT 0,
    max_discount numeric(10,2),
    usage_limit integer,
    usage_per_customer integer DEFAULT 1,
    current_usage integer DEFAULT 0,
    applicable_items jsonb,
    valid_from timestamp with time zone NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    customer_id uuid,
    loyalty_points_required integer
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    user_type character varying(50) NOT NULL,
    token text NOT NULL,
    device_type character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: reports_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports_archive (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    report_type character varying(100) NOT NULL,
    report_period character varying(50),
    start_date date NOT NULL,
    end_date date NOT NULL,
    data jsonb NOT NULL,
    file_url text,
    generated_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: restaurant_tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_tables (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    table_number integer NOT NULL,
    capacity integer NOT NULL,
    status public.table_status DEFAULT 'available'::public.table_status,
    section character varying(50),
    floor integer DEFAULT 1,
    "position" jsonb,
    current_order_id uuid,
    current_customers integer DEFAULT 0,
    assigned_waiter_id uuid,
    reserved_by uuid,
    reservation_time timestamp with time zone,
    reservation_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: review_helpful_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_helpful_votes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    review_id uuid NOT NULL,
    customer_id uuid,
    ip_address character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    customer_id uuid,
    order_id uuid,
    item_id uuid,
    meal_id uuid,
    rating integer,
    comment text,
    images jsonb DEFAULT '[]'::jsonb,
    is_verified boolean DEFAULT false,
    is_visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    admin_reply text,
    replied_at timestamp with time zone,
    review_type character varying(20) DEFAULT 'overall'::character varying,
    helpful_count integer DEFAULT 0,
    replied_by uuid,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: site_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_content (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    page character varying(100) NOT NULL,
    section character varying(100) NOT NULL,
    content jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: table_exchange_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_exchange_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    from_waiter_id uuid NOT NULL,
    to_waiter_id uuid NOT NULL,
    table_id uuid NOT NULL,
    exchange_type character varying(20) NOT NULL,
    swap_table_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying,
    reason text,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: table_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_history (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    table_id uuid,
    order_id uuid,
    waiter_id uuid,
    customer_count integer,
    opened_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    total_bill numeric(10,2),
    tip_amount numeric(10,2) DEFAULT 0,
    notes text
);


--
-- Name: two_fa_setup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.two_fa_setup (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    user_type character varying(50) NOT NULL,
    secret text NOT NULL,
    backup_codes jsonb DEFAULT '[]'::jsonb,
    is_enabled boolean DEFAULT false,
    enabled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: waiter_order_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waiter_order_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    waiter_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_number text NOT NULL,
    table_id uuid,
    table_number integer,
    customer_id uuid,
    customer_name text,
    customer_phone text,
    customer_email text,
    customer_count integer DEFAULT 1,
    is_registered_customer boolean DEFAULT false,
    items jsonb NOT NULL,
    total_items integer DEFAULT 0,
    subtotal numeric(10,2) DEFAULT 0,
    discount numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    payment_method text,
    payment_status text DEFAULT 'pending'::text,
    tip_amount numeric(10,2) DEFAULT 0,
    invoice_number text,
    order_taken_at timestamp with time zone DEFAULT now() NOT NULL,
    order_confirmed_at timestamp with time zone,
    order_completed_at timestamp with time zone,
    order_status text DEFAULT 'pending'::text,
    confirmation_email_sent boolean DEFAULT false,
    confirmation_email_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE waiter_order_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.waiter_order_history IS 'Stores complete order history per waiter with customer and billing details';


--
-- Name: waiter_tips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waiter_tips (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    waiter_id uuid,
    order_id uuid,
    invoice_id uuid,
    tip_amount numeric(10,2) NOT NULL,
    table_id uuid,
    date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: website_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_content (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    key character varying(100) NOT NULL,
    title character varying(255),
    content jsonb NOT NULL,
    section character varying(100),
    is_active boolean DEFAULT true,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: attendance_codes attendance_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_codes
    ADD CONSTRAINT attendance_codes_code_key UNIQUE (code);


--
-- Name: attendance_codes attendance_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_codes
    ADD CONSTRAINT attendance_codes_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_employee_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_date_unique UNIQUE (employee_id, date);


--
-- Name: attendance attendance_employee_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: customer_invoice_records customer_invoice_records_customer_id_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoice_records
    ADD CONSTRAINT customer_invoice_records_customer_id_invoice_id_key UNIQUE (customer_id, invoice_id);


--
-- Name: customer_invoice_records customer_invoice_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoice_records
    ADD CONSTRAINT customer_invoice_records_pkey PRIMARY KEY (id);


--
-- Name: customer_promo_codes customer_promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_promo_codes
    ADD CONSTRAINT customer_promo_codes_code_key UNIQUE (code);


--
-- Name: customer_promo_codes customer_promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_promo_codes
    ADD CONSTRAINT customer_promo_codes_pkey PRIMARY KEY (id);


--
-- Name: customers customers_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_phone_key UNIQUE (phone);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: deal_items deal_items_deal_id_menu_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_items
    ADD CONSTRAINT deal_items_deal_id_menu_item_id_key UNIQUE (deal_id, menu_item_id);


--
-- Name: deal_items deal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_items
    ADD CONSTRAINT deal_items_pkey PRIMARY KEY (id);


--
-- Name: deals deals_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_code_key UNIQUE (code);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: deals deals_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_slug_key UNIQUE (slug);


--
-- Name: delivery_history delivery_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_history
    ADD CONSTRAINT delivery_history_pkey PRIMARY KEY (id);


--
-- Name: delivery_history delivery_history_rider_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_history
    ADD CONSTRAINT delivery_history_rider_id_order_id_key UNIQUE (rider_id, order_id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_licenses employee_licenses_license_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_licenses
    ADD CONSTRAINT employee_licenses_license_id_key UNIQUE (license_id);


--
-- Name: employee_licenses employee_licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_licenses
    ADD CONSTRAINT employee_licenses_pkey PRIMARY KEY (id);


--
-- Name: employee_payroll employee_payroll_emp_month_year_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll
    ADD CONSTRAINT employee_payroll_emp_month_year_unique UNIQUE (employee_id, month, year);


--
-- Name: employee_payroll employee_payroll_employee_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll
    ADD CONSTRAINT employee_payroll_employee_id_month_year_key UNIQUE (employee_id, month, year);


--
-- Name: employee_payroll employee_payroll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll
    ADD CONSTRAINT employee_payroll_pkey PRIMARY KEY (id);


--
-- Name: employees employees_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_id_key UNIQUE (employee_id);


--
-- Name: employees employees_license_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_license_id_key UNIQUE (license_id);


--
-- Name: employees employees_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_phone_key UNIQUE (phone);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: inventory_alerts inventory_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_alerts
    ADD CONSTRAINT inventory_alerts_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_name_key UNIQUE (name);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: inventory_suppliers inventory_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_key UNIQUE (employee_id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: loyalty_points loyalty_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: maintenance_mode maintenance_mode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_mode
    ADD CONSTRAINT maintenance_mode_pkey PRIMARY KEY (id);


--
-- Name: meals meals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_pkey PRIMARY KEY (id);


--
-- Name: meals meals_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_slug_key UNIQUE (slug);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_slug_key UNIQUE (slug);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_slug_key UNIQUE (slug);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_activity_log order_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_activity_log
    ADD CONSTRAINT order_activity_log_pkey PRIMARY KEY (id);


--
-- Name: order_cancellations order_cancellations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_cancellations
    ADD CONSTRAINT order_cancellations_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);


--
-- Name: password_reset_otps password_reset_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_otps
    ADD CONSTRAINT password_reset_otps_pkey PRIMARY KEY (id);


--
-- Name: password_reset_rate_limits password_reset_rate_limits_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_rate_limits
    ADD CONSTRAINT password_reset_rate_limits_email_key UNIQUE (email);


--
-- Name: password_reset_rate_limits password_reset_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_rate_limits
    ADD CONSTRAINT password_reset_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payment_records payment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_pkey PRIMARY KEY (id);


--
-- Name: payslips payslips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (id);


--
-- Name: perks_settings perks_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perks_settings
    ADD CONSTRAINT perks_settings_pkey PRIMARY KEY (id);


--
-- Name: perks_settings perks_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perks_settings
    ADD CONSTRAINT perks_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: promo_code_usage promo_code_usage_customer_id_deal_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_customer_id_deal_id_order_id_key UNIQUE (customer_id, deal_id, order_id);


--
-- Name: promo_code_usage promo_code_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- Name: reports_archive reports_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports_archive
    ADD CONSTRAINT reports_archive_pkey PRIMARY KEY (id);


--
-- Name: restaurant_tables restaurant_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_tables
    ADD CONSTRAINT restaurant_tables_pkey PRIMARY KEY (id);


--
-- Name: restaurant_tables restaurant_tables_table_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_tables
    ADD CONSTRAINT restaurant_tables_table_number_key UNIQUE (table_number);


--
-- Name: review_helpful_votes review_helpful_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: site_content site_content_page_section_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_content
    ADD CONSTRAINT site_content_page_section_key UNIQUE (page, section);


--
-- Name: site_content site_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_content
    ADD CONSTRAINT site_content_pkey PRIMARY KEY (id);


--
-- Name: table_exchange_requests table_exchange_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_exchange_requests
    ADD CONSTRAINT table_exchange_requests_pkey PRIMARY KEY (id);


--
-- Name: table_history table_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_history
    ADD CONSTRAINT table_history_pkey PRIMARY KEY (id);


--
-- Name: two_fa_setup two_fa_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.two_fa_setup
    ADD CONSTRAINT two_fa_setup_pkey PRIMARY KEY (id);


--
-- Name: waiter_order_history waiter_order_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_order_history
    ADD CONSTRAINT waiter_order_history_pkey PRIMARY KEY (id);


--
-- Name: waiter_order_history waiter_order_history_waiter_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_order_history
    ADD CONSTRAINT waiter_order_history_waiter_id_order_id_key UNIQUE (waiter_id, order_id);


--
-- Name: waiter_tips waiter_tips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_tips
    ADD CONSTRAINT waiter_tips_pkey PRIMARY KEY (id);


--
-- Name: website_content website_content_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_content
    ADD CONSTRAINT website_content_key_key UNIQUE (key);


--
-- Name: website_content website_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_content
    ADD CONSTRAINT website_content_pkey PRIMARY KEY (id);


--
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_date ON public.attendance USING btree (date);


--
-- Name: idx_attendance_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_employee ON public.attendance USING btree (employee_id);


--
-- Name: idx_attendance_employee_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_employee_date ON public.attendance USING btree (employee_id, date);


--
-- Name: idx_contact_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_messages_created_at ON public.contact_messages USING btree (created_at DESC);


--
-- Name: idx_contact_messages_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_messages_email ON public.contact_messages USING btree (email);


--
-- Name: idx_contact_messages_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_messages_priority ON public.contact_messages USING btree (priority);


--
-- Name: idx_contact_messages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_messages_status ON public.contact_messages USING btree (status);


--
-- Name: idx_customer_invoice_records_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_invoice_records_customer ON public.customer_invoice_records USING btree (customer_id);


--
-- Name: idx_customer_invoice_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_invoice_records_date ON public.customer_invoice_records USING btree (billed_at DESC);


--
-- Name: idx_customer_invoice_records_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_invoice_records_invoice ON public.customer_invoice_records USING btree (invoice_id);


--
-- Name: idx_customer_promo_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_promo_active ON public.customer_promo_codes USING btree (is_active, is_used);


--
-- Name: idx_customer_promo_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_promo_code ON public.customer_promo_codes USING btree (code);


--
-- Name: idx_customer_promo_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_promo_customer ON public.customer_promo_codes USING btree (customer_id);


--
-- Name: idx_customers_auth_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_auth_user ON public.customers USING btree (auth_user_id);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_customers_favorites; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_favorites ON public.customers USING gin (favorites);


--
-- Name: idx_customers_is_banned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_is_banned ON public.customers USING btree (is_banned);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_deal_items_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_items_deal ON public.deal_items USING btree (deal_id);


--
-- Name: idx_deal_items_deal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_items_deal_id ON public.deal_items USING btree (deal_id);


--
-- Name: idx_deal_items_menu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_items_menu ON public.deal_items USING btree (menu_item_id);


--
-- Name: idx_deal_items_menu_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_items_menu_item_id ON public.deal_items USING btree (menu_item_id);


--
-- Name: idx_deals_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_active ON public.deals USING btree (is_active, valid_from, valid_until) WHERE (is_active = true);


--
-- Name: idx_deals_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_code ON public.deals USING btree (code);


--
-- Name: idx_deals_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_featured ON public.deals USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_delivery_history_accepted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_history_accepted_at ON public.delivery_history USING btree (accepted_at DESC);


--
-- Name: idx_delivery_history_delivered_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_history_delivered_at ON public.delivery_history USING btree (delivered_at DESC);


--
-- Name: idx_delivery_history_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_history_order ON public.delivery_history USING btree (order_id);


--
-- Name: idx_delivery_history_rider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_history_rider ON public.delivery_history USING btree (rider_id);


--
-- Name: idx_delivery_history_rider_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_history_rider_date ON public.delivery_history USING btree (rider_id, accepted_at DESC);


--
-- Name: idx_delivery_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_history_status ON public.delivery_history USING btree (delivery_status);


--
-- Name: idx_employee_docs_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_docs_employee ON public.employee_documents USING btree (employee_id);


--
-- Name: idx_employee_documents_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_documents_employee ON public.employee_documents USING btree (employee_id);


--
-- Name: idx_employee_documents_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_documents_employee_id ON public.employee_documents USING btree (employee_id);


--
-- Name: idx_employee_documents_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_documents_name ON public.employee_documents USING btree (document_name);


--
-- Name: idx_employee_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_documents_type ON public.employee_documents USING btree (document_type);


--
-- Name: idx_employee_licenses_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_licenses_employee ON public.employee_licenses USING btree (employee_id);


--
-- Name: idx_employee_licenses_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_licenses_employee_id ON public.employee_licenses USING btree (employee_id);


--
-- Name: idx_employee_licenses_license; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_licenses_license ON public.employee_licenses USING btree (license_id);


--
-- Name: idx_employee_licenses_license_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_licenses_license_id ON public.employee_licenses USING btree (license_id);


--
-- Name: idx_employee_payroll_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_payroll_employee ON public.employee_payroll USING btree (employee_id);


--
-- Name: idx_employee_payroll_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_payroll_employee_id ON public.employee_payroll USING btree (employee_id);


--
-- Name: idx_employee_payroll_month_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_payroll_month_year ON public.employee_payroll USING btree (year, month);


--
-- Name: idx_employee_payroll_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_payroll_period ON public.employee_payroll USING btree (year, month);


--
-- Name: idx_employees_auth_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_auth_user ON public.employees USING btree (auth_user_id);


--
-- Name: idx_employees_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_created_at ON public.employees USING btree (created_at DESC);


--
-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_email ON public.employees USING btree (email);


--
-- Name: idx_employees_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_employee_id ON public.employees USING btree (employee_id);


--
-- Name: idx_employees_hired_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_hired_date ON public.employees USING btree (hired_date);


--
-- Name: idx_employees_license_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_license_id ON public.employees USING btree (license_id);


--
-- Name: idx_employees_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_name_search ON public.employees USING gin (name extensions.gin_trgm_ops);


--
-- Name: idx_employees_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_phone ON public.employees USING btree (phone);


--
-- Name: idx_employees_portal_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_portal_enabled ON public.employees USING btree (portal_enabled);


--
-- Name: idx_employees_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_role ON public.employees USING btree (role);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_inventory_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_category ON public.inventory USING btree (category);


--
-- Name: idx_inventory_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_name ON public.inventory USING btree (name);


--
-- Name: idx_invoices_bill_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_bill_status ON public.invoices USING btree (bill_status);


--
-- Name: idx_invoices_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_created ON public.invoices USING btree (created_at DESC);


--
-- Name: idx_invoices_created_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_created_date ON public.invoices USING btree (created_at DESC);


--
-- Name: idx_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer ON public.invoices USING btree (customer_id);


--
-- Name: idx_invoices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer_id ON public.invoices USING btree (customer_id);


--
-- Name: idx_invoices_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_order ON public.invoices USING btree (order_id);


--
-- Name: idx_invoices_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_order_id ON public.invoices USING btree (order_id);


--
-- Name: idx_invoices_table_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_table_number ON public.invoices USING btree (table_number);


--
-- Name: idx_leave_balances_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balances_employee_id ON public.leave_balances USING btree (employee_id);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_employee_id ON public.leave_requests USING btree (employee_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_loyalty_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_customer ON public.loyalty_points USING btree (customer_id);


--
-- Name: idx_loyalty_customer_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_customer_type ON public.loyalty_points USING btree (customer_id, type);


--
-- Name: idx_loyalty_points_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_points_customer ON public.loyalty_points USING btree (customer_id);


--
-- Name: idx_loyalty_points_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_points_type ON public.loyalty_points USING btree (type);


--
-- Name: idx_menu_items_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_available ON public.menu_items USING btree (is_available);


--
-- Name: idx_menu_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_category ON public.menu_items USING btree (category_id);


--
-- Name: idx_menu_items_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_featured ON public.menu_items USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_menu_items_has_variants; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_has_variants ON public.menu_items USING btree (has_variants) WHERE (has_variants = true);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, user_type);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, user_type) WHERE (is_read = false);


--
-- Name: idx_order_activity_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_activity_log_action ON public.order_activity_log USING btree (action);


--
-- Name: idx_order_activity_log_action_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_activity_log_action_by ON public.order_activity_log USING btree (action_by);


--
-- Name: idx_order_activity_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_activity_log_created_at ON public.order_activity_log USING btree (created_at);


--
-- Name: idx_order_activity_log_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_activity_log_order_id ON public.order_activity_log USING btree (order_id);


--
-- Name: idx_order_status_history_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_status_history_order ON public.order_status_history USING btree (order_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_customer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_status ON public.orders USING btree (customer_id, status);


--
-- Name: idx_orders_online_payment_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_online_payment_method ON public.orders USING btree (online_payment_method_id) WHERE (online_payment_method_id IS NOT NULL);


--
-- Name: idx_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: idx_orders_order_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_type ON public.orders USING btree (order_type);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status_created ON public.orders USING btree (status, created_at DESC);


--
-- Name: idx_orders_table_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_table_number ON public.orders USING btree (table_number);


--
-- Name: idx_orders_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_transaction_id ON public.orders USING btree (transaction_id) WHERE (transaction_id IS NOT NULL);


--
-- Name: idx_orders_waiter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_waiter_id ON public.orders USING btree (waiter_id);


--
-- Name: idx_otp_codes_email_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_codes_email_expires ON public.otp_codes USING btree (email, expires_at);


--
-- Name: idx_otp_codes_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_codes_expires ON public.otp_codes USING btree (expires_at);


--
-- Name: idx_otp_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_email ON public.otp_codes USING btree (email);


--
-- Name: idx_otp_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_expires ON public.otp_codes USING btree (expires_at);


--
-- Name: idx_password_reset_otps_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_otps_email ON public.password_reset_otps USING btree (email);


--
-- Name: idx_password_reset_otps_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_otps_expires_at ON public.password_reset_otps USING btree (expires_at);


--
-- Name: idx_password_reset_rate_limits_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_rate_limits_email ON public.password_reset_rate_limits USING btree (email);


--
-- Name: idx_payment_methods_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_active ON public.payment_methods USING btree (is_active);


--
-- Name: idx_payment_methods_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_order ON public.payment_methods USING btree (display_order);


--
-- Name: idx_payment_methods_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_type ON public.payment_methods USING btree (method_type);


--
-- Name: idx_payment_records_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_records_customer ON public.payment_records USING btree (customer_id);


--
-- Name: idx_payment_records_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_records_order ON public.payment_records USING btree (order_id);


--
-- Name: idx_perks_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perks_settings_key ON public.perks_settings USING btree (setting_key);


--
-- Name: idx_promo_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_active ON public.promo_codes USING btree (is_active, valid_from, valid_until);


--
-- Name: idx_promo_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code ON public.promo_codes USING btree (code);


--
-- Name: idx_promo_code_usage_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_usage_customer ON public.promo_code_usage USING btree (customer_id);


--
-- Name: idx_promo_codes_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_customer_id ON public.promo_codes USING btree (customer_id);


--
-- Name: idx_promo_codes_loyalty_threshold; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_loyalty_threshold ON public.promo_codes USING btree (customer_id, loyalty_points_required);


--
-- Name: idx_review_helpful_votes_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_review_helpful_votes_customer ON public.review_helpful_votes USING btree (review_id, customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_review_helpful_votes_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_review_helpful_votes_ip ON public.review_helpful_votes USING btree (review_id, ip_address) WHERE ((customer_id IS NULL) AND (ip_address IS NOT NULL));


--
-- Name: idx_reviews_admin_reply; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_admin_reply ON public.reviews USING btree (admin_reply) WHERE (admin_reply IS NOT NULL);


--
-- Name: idx_reviews_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_created_at ON public.reviews USING btree (created_at DESC);


--
-- Name: idx_reviews_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_created_at_desc ON public.reviews USING btree (created_at DESC);


--
-- Name: idx_reviews_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_customer ON public.reviews USING btree (customer_id);


--
-- Name: idx_reviews_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_customer_id ON public.reviews USING btree (customer_id);


--
-- Name: idx_reviews_helpful_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_helpful_count ON public.reviews USING btree (helpful_count DESC) WHERE (helpful_count > 0);


--
-- Name: idx_reviews_is_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_is_visible ON public.reviews USING btree (is_visible);


--
-- Name: idx_reviews_is_visible_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_is_visible_rating ON public.reviews USING btree (is_visible, rating);


--
-- Name: idx_reviews_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_item ON public.reviews USING btree (item_id);


--
-- Name: idx_reviews_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_item_id ON public.reviews USING btree (item_id);


--
-- Name: idx_reviews_meal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_meal ON public.reviews USING btree (meal_id);


--
-- Name: idx_reviews_meal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_meal_id ON public.reviews USING btree (meal_id);


--
-- Name: idx_reviews_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_rating ON public.reviews USING btree (rating);


--
-- Name: idx_reviews_review_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_review_type ON public.reviews USING btree (review_type);


--
-- Name: idx_table_exchange_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_exchange_from ON public.table_exchange_requests USING btree (from_waiter_id);


--
-- Name: idx_table_exchange_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_exchange_to ON public.table_exchange_requests USING btree (to_waiter_id);


--
-- Name: idx_table_history_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_history_table ON public.table_history USING btree (table_id);


--
-- Name: idx_waiter_history_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiter_history_date ON public.waiter_order_history USING btree (order_taken_at DESC);


--
-- Name: idx_waiter_history_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiter_history_order ON public.waiter_order_history USING btree (order_id);


--
-- Name: idx_waiter_history_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiter_history_table ON public.waiter_order_history USING btree (table_id);


--
-- Name: idx_waiter_history_waiter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiter_history_waiter ON public.waiter_order_history USING btree (waiter_id);


--
-- Name: idx_waiter_history_waiter_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiter_history_waiter_date ON public.waiter_order_history USING btree (waiter_id, order_taken_at DESC);


--
-- Name: idx_waiter_tips_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiter_tips_date ON public.waiter_tips USING btree (date);


--
-- Name: idx_waiter_tips_waiter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiter_tips_waiter ON public.waiter_tips USING btree (waiter_id);


--
-- Name: inventory_sku_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_sku_unique ON public.inventory USING btree (sku) WHERE (sku IS NOT NULL);


--
-- Name: maintenance_mode_single_row_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX maintenance_mode_single_row_idx ON public.maintenance_mode USING btree (((id IS NOT NULL)));


--
-- Name: loyalty_points loyalty_points_award_promo_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER loyalty_points_award_promo_trigger AFTER INSERT ON public.loyalty_points FOR EACH ROW EXECUTE FUNCTION public.award_loyalty_promo_on_points_insert();


--
-- Name: menu_items menu_item_slug_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER menu_item_slug_trigger BEFORE INSERT OR UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.auto_generate_menu_item_slug();


--
-- Name: notifications on_new_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_notification AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notify_new_notification();


--
-- Name: orders on_order_status_auto_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_order_status_auto_log AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.auto_log_order_status_change();


--
-- Name: orders on_order_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_order_status_change AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();


--
-- Name: employees set_employee_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_employee_id BEFORE INSERT ON public.employees FOR EACH ROW EXECUTE FUNCTION public.generate_employee_id();


--
-- Name: invoices set_invoice_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_invoice_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();


--
-- Name: orders set_order_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();


--
-- Name: otp_codes trigger_cleanup_otps; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cleanup_otps AFTER INSERT ON public.otp_codes FOR EACH ROW EXECUTE FUNCTION public.auto_cleanup_otps_trigger();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employee_payroll update_employee_payroll_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employee_payroll_updated_at BEFORE UPDATE ON public.employee_payroll FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory update_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: loyalty_points update_loyalty_points_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_loyalty_points_updated_at BEFORE UPDATE ON public.loyalty_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: menu_items update_menu_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: promo_codes update_promo_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: restaurant_tables update_restaurant_tables_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_restaurant_tables_updated_at BEFORE UPDATE ON public.restaurant_tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: website_content update_website_content_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_website_content_updated_at BEFORE UPDATE ON public.website_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendance_codes attendance_codes_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_codes
    ADD CONSTRAINT attendance_codes_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.employees(id);


--
-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: contact_messages contact_messages_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: contact_messages contact_messages_replied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES public.employees(id);


--
-- Name: customer_invoice_records customer_invoice_records_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoice_records
    ADD CONSTRAINT customer_invoice_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_invoice_records customer_invoice_records_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoice_records
    ADD CONSTRAINT customer_invoice_records_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: customer_invoice_records customer_invoice_records_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_invoice_records
    ADD CONSTRAINT customer_invoice_records_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: customer_promo_codes customer_promo_codes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_promo_codes
    ADD CONSTRAINT customer_promo_codes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_promo_codes customer_promo_codes_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_promo_codes
    ADD CONSTRAINT customer_promo_codes_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;


--
-- Name: customer_promo_codes customer_promo_codes_used_on_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_promo_codes
    ADD CONSTRAINT customer_promo_codes_used_on_order_id_fkey FOREIGN KEY (used_on_order_id) REFERENCES public.orders(id);


--
-- Name: customers customers_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customers customers_banned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.employees(id);


--
-- Name: customers customers_unbanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_unbanned_by_fkey FOREIGN KEY (unbanned_by) REFERENCES public.employees(id);


--
-- Name: deal_items deal_items_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_items
    ADD CONSTRAINT deal_items_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: deal_items deal_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_items
    ADD CONSTRAINT deal_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: delivery_history delivery_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_history
    ADD CONSTRAINT delivery_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: delivery_history delivery_history_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_history
    ADD CONSTRAINT delivery_history_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.employees(id);


--
-- Name: employee_licenses employee_licenses_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_licenses
    ADD CONSTRAINT employee_licenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_payroll employee_payroll_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll
    ADD CONSTRAINT employee_payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_payroll employee_payroll_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll
    ADD CONSTRAINT employee_payroll_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.employees(id);


--
-- Name: employees employees_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: employees employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id);


--
-- Name: orders fk_orders_payment_method; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_orders_payment_method FOREIGN KEY (online_payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;


--
-- Name: inventory_alerts inventory_alerts_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_alerts
    ADD CONSTRAINT inventory_alerts_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- Name: inventory_alerts inventory_alerts_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_alerts
    ADD CONSTRAINT inventory_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.employees(id);


--
-- Name: inventory_categories inventory_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.inventory_categories(id);


--
-- Name: inventory inventory_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.employees(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id);


--
-- Name: inventory_purchase_orders inventory_purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id);


--
-- Name: inventory_transactions inventory_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id);


--
-- Name: inventory_transactions inventory_transactions_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- Name: inventory_transactions inventory_transactions_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.employees(id);


--
-- Name: invoices invoices_billed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_billed_by_fkey FOREIGN KEY (billed_by) REFERENCES public.employees(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: invoices invoices_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id);


--
-- Name: invoices invoices_served_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_served_by_fkey FOREIGN KEY (served_by) REFERENCES public.employees(id);


--
-- Name: invoices invoices_voided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.employees(id);


--
-- Name: leave_balances leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.employees(id);


--
-- Name: loyalty_points loyalty_points_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: loyalty_points loyalty_points_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: loyalty_transactions loyalty_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id);


--
-- Name: loyalty_transactions loyalty_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: loyalty_transactions loyalty_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: maintenance_mode maintenance_mode_enabled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_mode
    ADD CONSTRAINT maintenance_mode_enabled_by_fkey FOREIGN KEY (enabled_by) REFERENCES public.employees(id);


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE SET NULL;


--
-- Name: order_activity_log order_activity_log_action_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_activity_log
    ADD CONSTRAINT order_activity_log_action_by_fkey FOREIGN KEY (action_by) REFERENCES public.employees(id);


--
-- Name: order_activity_log order_activity_log_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_activity_log
    ADD CONSTRAINT order_activity_log_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_cancellations order_cancellations_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_cancellations
    ADD CONSTRAINT order_cancellations_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.employees(id);


--
-- Name: order_cancellations order_cancellations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_cancellations
    ADD CONSTRAINT order_cancellations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.employees(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: orders orders_delivery_rider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_rider_id_fkey FOREIGN KEY (delivery_rider_id) REFERENCES public.employees(id);


--
-- Name: orders orders_prepared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.employees(id);


--
-- Name: orders orders_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.employees(id);


--
-- Name: payment_records payment_records_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: payment_records payment_records_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: payment_records payment_records_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.employees(id);


--
-- Name: payslips payslips_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id);


--
-- Name: payslips payslips_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: perks_settings perks_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perks_settings
    ADD CONSTRAINT perks_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.employees(id);


--
-- Name: promo_code_usage promo_code_usage_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: promo_code_usage promo_code_usage_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: promo_code_usage promo_code_usage_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: promo_codes promo_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id);


--
-- Name: promo_codes promo_codes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: reports_archive reports_archive_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports_archive
    ADD CONSTRAINT reports_archive_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.employees(id);


--
-- Name: restaurant_tables restaurant_tables_assigned_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_tables
    ADD CONSTRAINT restaurant_tables_assigned_waiter_id_fkey FOREIGN KEY (assigned_waiter_id) REFERENCES public.employees(id);


--
-- Name: restaurant_tables restaurant_tables_reserved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_tables
    ADD CONSTRAINT restaurant_tables_reserved_by_fkey FOREIGN KEY (reserved_by) REFERENCES public.customers(id);


--
-- Name: review_helpful_votes review_helpful_votes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: review_helpful_votes review_helpful_votes_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpful_votes
    ADD CONSTRAINT review_helpful_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.meals(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_replied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES public.employees(id);


--
-- Name: table_exchange_requests table_exchange_requests_from_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_exchange_requests
    ADD CONSTRAINT table_exchange_requests_from_waiter_id_fkey FOREIGN KEY (from_waiter_id) REFERENCES public.employees(id);


--
-- Name: table_exchange_requests table_exchange_requests_swap_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_exchange_requests
    ADD CONSTRAINT table_exchange_requests_swap_table_id_fkey FOREIGN KEY (swap_table_id) REFERENCES public.restaurant_tables(id);


--
-- Name: table_exchange_requests table_exchange_requests_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_exchange_requests
    ADD CONSTRAINT table_exchange_requests_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id);


--
-- Name: table_exchange_requests table_exchange_requests_to_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_exchange_requests
    ADD CONSTRAINT table_exchange_requests_to_waiter_id_fkey FOREIGN KEY (to_waiter_id) REFERENCES public.employees(id);


--
-- Name: table_history table_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_history
    ADD CONSTRAINT table_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: table_history table_history_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_history
    ADD CONSTRAINT table_history_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id) ON DELETE CASCADE;


--
-- Name: table_history table_history_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_history
    ADD CONSTRAINT table_history_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.employees(id);


--
-- Name: waiter_order_history waiter_order_history_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_order_history
    ADD CONSTRAINT waiter_order_history_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: waiter_order_history waiter_order_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_order_history
    ADD CONSTRAINT waiter_order_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: waiter_order_history waiter_order_history_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_order_history
    ADD CONSTRAINT waiter_order_history_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id);


--
-- Name: waiter_order_history waiter_order_history_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_order_history
    ADD CONSTRAINT waiter_order_history_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: waiter_tips waiter_tips_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_tips
    ADD CONSTRAINT waiter_tips_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: waiter_tips waiter_tips_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_tips
    ADD CONSTRAINT waiter_tips_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: waiter_tips waiter_tips_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_tips
    ADD CONSTRAINT waiter_tips_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id);


--
-- Name: waiter_tips waiter_tips_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiter_tips
    ADD CONSTRAINT waiter_tips_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: website_content website_content_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_content
    ADD CONSTRAINT website_content_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.employees(id);


--
-- Name: payment_methods Admin can manage payment methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage payment methods" ON public.payment_methods USING (public.is_manager_or_admin());


--
-- Name: contact_messages Admins can do everything with contact messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can do everything with contact messages" ON public.contact_messages TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.auth_user_id = auth.uid()) AND (e.role = 'admin'::public.user_role))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.auth_user_id = auth.uid()) AND (e.role = 'admin'::public.user_role)))));


--
-- Name: deal_items Admins can manage deal items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage deal items" ON public.deal_items USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid()))));


--
-- Name: employee_documents Admins can manage employee_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage employee_documents" ON public.employee_documents USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: employee_licenses Admins can manage employee_licenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage employee_licenses" ON public.employee_licenses USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: employee_payroll Admins can manage employee_payroll; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage employee_payroll" ON public.employee_payroll USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: otp_codes Allow OTP operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow OTP operations" ON public.otp_codes USING (true) WITH CHECK (true);


--
-- Name: contact_messages Allow insert for API; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert for API" ON public.contact_messages FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: employee_licenses Allow license activation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow license activation" ON public.employee_licenses FOR UPDATE USING ((is_used = false)) WITH CHECK (true);


--
-- Name: customers Anyone can create customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create customer" ON public.customers FOR INSERT WITH CHECK (true);


--
-- Name: review_helpful_votes Anyone can insert helpful votes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert helpful votes" ON public.review_helpful_votes FOR INSERT WITH CHECK (true);


--
-- Name: maintenance_mode Anyone can read maintenance status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read maintenance status" ON public.maintenance_mode FOR SELECT USING (true);


--
-- Name: site_content Anyone can view active content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active content" ON public.site_content FOR SELECT USING ((is_active = true));


--
-- Name: deals Anyone can view active deals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active deals" ON public.deals FOR SELECT USING (((is_active = true) AND ((now() >= COALESCE(valid_from, now())) AND (now() <= COALESCE(valid_until, (now() + '100 years'::interval))))));


--
-- Name: menu_items Anyone can view available items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view available items" ON public.menu_items FOR SELECT USING ((is_available = true));


--
-- Name: meals Anyone can view available meals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view available meals" ON public.meals FOR SELECT USING ((is_available = true));


--
-- Name: deal_items Anyone can view deal items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view deal items" ON public.deal_items FOR SELECT USING (true);


--
-- Name: review_helpful_votes Anyone can view helpful votes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view helpful votes" ON public.review_helpful_votes FOR SELECT USING (true);


--
-- Name: reviews Anyone can view visible reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view visible reviews" ON public.reviews FOR SELECT USING ((is_visible = true));


--
-- Name: order_activity_log Authenticated users can insert order activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert order activity logs" ON public.order_activity_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: order_activity_log Authenticated users can view order activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view order activity logs" ON public.order_activity_log FOR SELECT TO authenticated USING (true);


--
-- Name: reviews Customers can create reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create reviews" ON public.reviews FOR INSERT WITH CHECK ((customer_id IS NOT NULL));


--
-- Name: reviews Customers can delete own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can delete own reviews" ON public.reviews FOR DELETE USING ((customer_id = auth.uid()));


--
-- Name: customers Customers can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update own profile" ON public.customers FOR UPDATE USING ((auth.uid() = auth_user_id));


--
-- Name: reviews Customers can update own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update own reviews" ON public.reviews FOR UPDATE USING ((customer_id = auth.uid()));


--
-- Name: customers Customers can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own profile" ON public.customers FOR SELECT USING ((auth.uid() = auth_user_id));


--
-- Name: inventory_transactions Employees can insert transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can insert transactions" ON public.inventory_transactions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::public.employee_status)))));


--
-- Name: employees Employees can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update own profile" ON public.employees FOR UPDATE USING ((auth.uid() = auth_user_id));


--
-- Name: inventory Employees can view inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view inventory" ON public.inventory FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::public.employee_status)))));


--
-- Name: employee_documents Employees can view own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own documents" ON public.employee_documents FOR SELECT USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid()))));


--
-- Name: employee_licenses Employees can view own license; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own license" ON public.employee_licenses FOR SELECT USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid()))));


--
-- Name: employee_payroll Employees can view own payroll; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own payroll" ON public.employee_payroll FOR SELECT USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid()))));


--
-- Name: employees Employees can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own profile" ON public.employees FOR SELECT USING ((auth.uid() = auth_user_id));


--
-- Name: inventory_transactions Employees can view transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view transactions" ON public.inventory_transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::public.employee_status)))));


--
-- Name: leave_requests Employees insert own leave requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees insert own leave requests" ON public.leave_requests FOR INSERT WITH CHECK ((employee_id = public.get_employee_id()));


--
-- Name: leave_requests Employees view own leave requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees view own leave requests" ON public.leave_requests FOR SELECT USING (((employee_id = public.get_employee_id()) OR public.is_manager_or_admin()));


--
-- Name: inventory Managers can manage inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can manage inventory" ON public.inventory USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::public.employee_status) AND (employees.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: contact_messages Managers can update contact messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can update contact messages" ON public.contact_messages FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.auth_user_id = auth.uid()) AND (e.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.auth_user_id = auth.uid()) AND (e.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: contact_messages Managers can view and update contact messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can view and update contact messages" ON public.contact_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.auth_user_id = auth.uid()) AND (e.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: leave_balances Managers update leave balances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers update leave balances" ON public.leave_balances USING (public.is_manager_or_admin());


--
-- Name: leave_requests Managers update leave requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers update leave requests" ON public.leave_requests FOR UPDATE USING ((((employee_id = public.get_employee_id()) AND ((status)::text = 'pending'::text)) OR public.is_manager_or_admin()));


--
-- Name: maintenance_mode Only admin can modify maintenance mode; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admin can modify maintenance mode" ON public.maintenance_mode USING (public.is_admin());


--
-- Name: otp_codes Public can read OTP for verification; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read OTP for verification" ON public.otp_codes FOR SELECT USING (true);


--
-- Name: payment_methods Public can view active payment methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active payment methods" ON public.payment_methods FOR SELECT USING ((is_active = true));


--
-- Name: reviews Public can view visible reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view visible reviews" ON public.reviews FOR SELECT USING ((is_visible = true));


--
-- Name: password_reset_otps Service role only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only" ON public.password_reset_otps USING (false) WITH CHECK (false);


--
-- Name: password_reset_rate_limits Service role only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only" ON public.password_reset_rate_limits USING (false) WITH CHECK (false);


--
-- Name: otp_codes System can create OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create OTP" ON public.otp_codes FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs System can create audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: notifications System can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: loyalty_points System can manage loyalty points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage loyalty points" ON public.loyalty_points FOR INSERT WITH CHECK (true);


--
-- Name: otp_codes System can update OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can update OTP" ON public.otp_codes FOR UPDATE USING (true);


--
-- Name: leave_balances View own leave balance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View own leave balance" ON public.leave_balances FOR SELECT USING (((employee_id = public.get_employee_id()) OR public.is_manager_or_admin()));


--
-- Name: employees admins_delete_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_delete_employees ON public.employees FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: employees admins_insert_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_insert_employees ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: attendance admins_manage_attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_attendance ON public.attendance TO authenticated USING ((public.is_admin() OR (employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid()))))) WITH CHECK ((public.is_admin() OR (employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid())))));


--
-- Name: audit_logs admins_manage_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_audit_logs ON public.audit_logs TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: employee_documents admins_manage_employee_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_employee_documents ON public.employee_documents TO authenticated USING ((public.is_admin() OR (employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid()))))) WITH CHECK (public.is_admin());


--
-- Name: employee_licenses admins_manage_employee_licenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_employee_licenses ON public.employee_licenses TO authenticated USING ((public.is_admin() OR (employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid()))))) WITH CHECK (public.is_admin());


--
-- Name: employee_payroll admins_manage_employee_payroll; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_employee_payroll ON public.employee_payroll TO authenticated USING ((public.is_admin() OR (employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid()))))) WITH CHECK (public.is_admin());


--
-- Name: inventory_alerts admins_manage_inventory_alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_inventory_alerts ON public.inventory_alerts TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: inventory_categories admins_manage_inventory_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_inventory_categories ON public.inventory_categories TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: inventory_purchase_orders admins_manage_inventory_purchase_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_inventory_purchase_orders ON public.inventory_purchase_orders TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: inventory_suppliers admins_manage_inventory_suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_inventory_suppliers ON public.inventory_suppliers TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: employees admins_select_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_select_employees ON public.employees FOR SELECT TO authenticated USING ((public.is_admin() OR (auth_user_id = auth.uid())));


--
-- Name: employees admins_update_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_update_employees ON public.employees FOR UPDATE TO authenticated USING ((public.is_admin() OR (auth_user_id = auth.uid()))) WITH CHECK ((public.is_admin() OR (auth_user_id = auth.uid())));


--
-- Name: attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_insert_system ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: audit_logs audit_logs_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_select_admin ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: menu_categories categories_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_delete_admin ON public.menu_categories FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: menu_categories categories_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_insert_admin ON public.menu_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: menu_categories categories_select_employee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_select_employee ON public.menu_categories FOR SELECT TO authenticated USING (public.is_employee());


--
-- Name: menu_categories categories_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_select_public ON public.menu_categories FOR SELECT TO authenticated, anon USING ((is_visible = true));


--
-- Name: menu_categories categories_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_update_admin ON public.menu_categories FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_invoice_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_invoice_records ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_invoice_records customer_invoice_records_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_invoice_records_insert ON public.customer_invoice_records FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: customer_invoice_records customer_invoice_records_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_invoice_records_select ON public.customer_invoice_records FOR SELECT TO authenticated USING (true);


--
-- Name: customer_promo_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_promo_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_promo_codes customer_promo_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_promo_delete ON public.customer_promo_codes FOR DELETE TO authenticated USING (true);


--
-- Name: customer_promo_codes customer_promo_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_promo_insert ON public.customer_promo_codes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: customer_promo_codes customer_promo_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_promo_select ON public.customer_promo_codes FOR SELECT TO authenticated USING (true);


--
-- Name: customer_promo_codes customer_promo_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_promo_update ON public.customer_promo_codes FOR UPDATE TO authenticated USING (true);


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_delete_admin ON public.customers FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: customers customers_insert_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_insert_system ON public.customers FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: customers customers_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_select_anon ON public.customers FOR SELECT TO anon USING (true);


--
-- Name: customers customers_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_select_own ON public.customers FOR SELECT TO authenticated USING (((auth_user_id = auth.uid()) OR public.is_employee()));


--
-- Name: customers customers_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_update_own ON public.customers FOR UPDATE TO authenticated USING ((auth_user_id = auth.uid())) WITH CHECK ((auth_user_id = auth.uid()));


--
-- Name: deal_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deal_items ENABLE ROW LEVEL SECURITY;

--
-- Name: deal_items deal_items_delete_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deal_items_delete_employees ON public.deal_items FOR DELETE TO authenticated USING (true);


--
-- Name: deal_items deal_items_insert_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deal_items_insert_employees ON public.deal_items FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: deal_items deal_items_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deal_items_select_all ON public.deal_items FOR SELECT USING (true);


--
-- Name: deal_items deal_items_update_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deal_items_update_employees ON public.deal_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: deals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

--
-- Name: deals deals_delete_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_delete_employees ON public.deals FOR DELETE TO authenticated USING (true);


--
-- Name: deals deals_insert_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_insert_employees ON public.deals FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: deals deals_manage_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_manage_admin ON public.deals TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: deals deals_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_select_all ON public.deals FOR SELECT USING (true);


--
-- Name: deals deals_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_select_anon ON public.deals FOR SELECT TO anon USING (true);


--
-- Name: deals deals_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_select_public ON public.deals FOR SELECT TO authenticated, anon USING (((is_active = true) AND ((valid_from IS NULL) OR (valid_from <= now())) AND ((valid_until IS NULL) OR (valid_until >= now()))));


--
-- Name: deals deals_update_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deals_update_employees ON public.deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: delivery_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_history ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_history delivery_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_history_insert ON public.delivery_history FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: delivery_history delivery_history_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_history_select_own ON public.delivery_history FOR SELECT TO authenticated USING (((rider_id = public.get_employee_id()) OR (EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.id = public.get_employee_id()) AND (e.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])))))));


--
-- Name: delivery_history delivery_history_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_history_update_own ON public.delivery_history FOR UPDATE TO authenticated USING ((rider_id = public.get_employee_id())) WITH CHECK ((rider_id = public.get_employee_id()));


--
-- Name: employee_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_licenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_licenses ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_payroll; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_payroll ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: employees employees_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_delete_admin ON public.employees FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: employees employees_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_insert_admin ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: employees employees_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_select ON public.employees FOR SELECT TO authenticated USING (((auth_user_id = auth.uid()) OR public.is_admin()));


--
-- Name: employees employees_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_update_admin ON public.employees FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_points loyalty_insert_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_insert_system ON public.loyalty_points FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: loyalty_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_points loyalty_points_insert_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_points_insert_anon ON public.loyalty_points FOR INSERT TO anon WITH CHECK (true);


--
-- Name: loyalty_points loyalty_points_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_points_select_anon ON public.loyalty_points FOR SELECT TO anon USING (true);


--
-- Name: loyalty_points loyalty_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_select_own ON public.loyalty_points FOR SELECT TO authenticated USING (((customer_id = public.get_my_customer_id()) OR public.is_employee()));


--
-- Name: maintenance_mode; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_mode ENABLE ROW LEVEL SECURITY;

--
-- Name: meals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

--
-- Name: meals meals_manage_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meals_manage_admin ON public.meals TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: meals meals_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meals_select_anon ON public.meals FOR SELECT TO anon USING (true);


--
-- Name: meals meals_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meals_select_public ON public.meals FOR SELECT TO authenticated, anon USING ((is_available = true));


--
-- Name: menu_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_categories menu_categories_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_categories_delete_admin ON public.menu_categories FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = 'admin'::public.user_role) AND (employees.status = 'active'::public.employee_status)))));


--
-- Name: menu_categories menu_categories_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_categories_insert_admin ON public.menu_categories FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])) AND (employees.status = 'active'::public.employee_status)))));


--
-- Name: menu_categories menu_categories_select_employee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_categories_select_employee ON public.menu_categories FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.status = 'active'::public.employee_status)))));


--
-- Name: menu_categories menu_categories_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_categories_select_public ON public.menu_categories FOR SELECT TO authenticated, anon USING ((is_visible = true));


--
-- Name: menu_categories menu_categories_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_categories_update_admin ON public.menu_categories FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])) AND (employees.status = 'active'::public.employee_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])) AND (employees.status = 'active'::public.employee_status)))));


--
-- Name: menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_items menu_items_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_delete_admin ON public.menu_items FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: menu_items menu_items_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_insert_admin ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: menu_items menu_items_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_select_anon ON public.menu_items FOR SELECT TO anon USING (true);


--
-- Name: menu_items menu_items_select_employee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_select_employee ON public.menu_items FOR SELECT TO authenticated USING (public.is_employee());


--
-- Name: menu_items menu_items_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_select_public ON public.menu_items FOR SELECT TO authenticated, anon USING ((is_available = true));


--
-- Name: menu_items menu_items_update_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_update_employees ON public.menu_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE (employees.auth_user_id = auth.uid()))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_insert_anon ON public.notifications FOR INSERT TO anon WITH CHECK (true);


--
-- Name: notifications notifications_insert_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_insert_system ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING (((((user_type)::text = 'customer'::text) AND (user_id = public.get_my_customer_id())) OR (((user_type)::text = 'employee'::text) AND (user_id = public.get_my_employee_id()))));


--
-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING (((((user_type)::text = 'customer'::text) AND (user_id = public.get_my_customer_id())) OR (((user_type)::text = 'employee'::text) AND (user_id = public.get_my_employee_id()))));


--
-- Name: order_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: order_status_history order_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_history_insert ON public.order_status_history FOR INSERT TO authenticated WITH CHECK (public.is_employee());


--
-- Name: order_status_history order_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_history_select ON public.order_status_history FOR SELECT TO authenticated USING (((order_id IN ( SELECT orders.id
   FROM public.orders
  WHERE (orders.customer_id = public.get_my_customer_id()))) OR public.is_employee()));


--
-- Name: order_status_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: order_status_history order_status_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_status_history_insert ON public.order_status_history FOR INSERT WITH CHECK (true);


--
-- Name: order_status_history order_status_history_insert_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_status_history_insert_anon ON public.order_status_history FOR INSERT TO anon WITH CHECK (true);


--
-- Name: order_status_history order_status_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_status_history_select ON public.order_status_history FOR SELECT USING (true);


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_insert_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_insert_anon ON public.orders FOR INSERT TO anon WITH CHECK (true);


--
-- Name: orders orders_insert_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_insert_customer ON public.orders FOR INSERT TO authenticated WITH CHECK ((customer_id = public.get_my_customer_id()));


--
-- Name: orders orders_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select_anon ON public.orders FOR SELECT TO anon USING (true);


--
-- Name: orders orders_select_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select_customer ON public.orders FOR SELECT TO authenticated USING ((customer_id = public.get_my_customer_id()));


--
-- Name: orders orders_select_employee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select_employee ON public.orders FOR SELECT TO authenticated USING (public.is_employee());


--
-- Name: orders orders_update_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_update_customer ON public.orders FOR UPDATE TO authenticated USING (((customer_id = public.get_my_customer_id()) AND (status = 'pending'::public.order_status)));


--
-- Name: orders orders_update_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_update_staff ON public.orders FOR UPDATE TO authenticated USING (public.is_employee());


--
-- Name: otp_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: otp_codes otp_insert_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_insert_public ON public.otp_codes FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: otp_codes otp_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_select_public ON public.otp_codes FOR SELECT TO authenticated, anon USING (true);


--
-- Name: otp_codes otp_update_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY otp_update_public ON public.otp_codes FOR UPDATE TO authenticated, anon USING (true);


--
-- Name: password_reset_otps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_records payment_records_insert_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_records_insert_customer ON public.payment_records FOR INSERT TO authenticated WITH CHECK ((customer_id = public.get_my_customer_id()));


--
-- Name: payment_records payment_records_select_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_records_select_customer ON public.payment_records FOR SELECT TO authenticated USING ((customer_id = public.get_my_customer_id()));


--
-- Name: payment_records payment_records_select_employee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_records_select_employee ON public.payment_records FOR SELECT TO authenticated USING (public.is_employee());


--
-- Name: payment_records payment_records_update_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_records_update_staff ON public.payment_records FOR UPDATE TO authenticated USING (public.has_role(ARRAY['admin'::text, 'cashier'::text]));


--
-- Name: perks_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.perks_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: perks_settings perks_settings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perks_settings_insert ON public.perks_settings FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: perks_settings perks_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perks_settings_select ON public.perks_settings FOR SELECT TO authenticated USING (true);


--
-- Name: perks_settings perks_settings_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perks_settings_select_anon ON public.perks_settings FOR SELECT TO anon USING (true);


--
-- Name: perks_settings perks_settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perks_settings_update ON public.perks_settings FOR UPDATE TO authenticated USING (true);


--
-- Name: promo_code_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_code_usage promo_code_usage_insert_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_code_usage_insert_anon ON public.promo_code_usage FOR INSERT TO anon WITH CHECK (true);


--
-- Name: promo_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_codes promo_codes_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_codes_delete_admin ON public.promo_codes FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])) AND (promo_codes.is_active = true)))));


--
-- Name: promo_codes promo_codes_delete_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_codes_delete_employees ON public.promo_codes FOR DELETE TO authenticated USING (true);


--
-- Name: promo_codes promo_codes_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_codes_insert_admin ON public.promo_codes FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])) AND (promo_codes.is_active = true)))));


--
-- Name: promo_codes promo_codes_insert_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_codes_insert_employees ON public.promo_codes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: promo_codes promo_codes_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_codes_select_all ON public.promo_codes FOR SELECT TO authenticated USING (true);


--
-- Name: promo_codes promo_codes_select_general; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_codes_select_general ON public.promo_codes FOR SELECT TO authenticated USING ((customer_id IS NULL));


--
-- Name: promo_codes promo_codes_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_codes_select_own ON public.promo_codes FOR SELECT TO authenticated USING ((customer_id = auth.uid()));


--
-- Name: promo_codes promo_codes_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_codes_update_admin ON public.promo_codes FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.auth_user_id = auth.uid()) AND (employees.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])) AND (promo_codes.is_active = true)))));


--
-- Name: promo_codes promo_codes_update_employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_codes_update_employees ON public.promo_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: promo_code_usage promo_usage_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_usage_insert ON public.promo_code_usage FOR INSERT TO authenticated WITH CHECK ((customer_id = public.get_my_customer_id()));


--
-- Name: promo_code_usage promo_usage_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_usage_select_own ON public.promo_code_usage FOR SELECT TO authenticated USING (((customer_id = public.get_my_customer_id()) OR public.is_employee()));


--
-- Name: review_helpful_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews reviews_insert_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_insert_customer ON public.reviews FOR INSERT TO authenticated WITH CHECK (((customer_id = public.get_my_customer_id()) AND (order_id IN ( SELECT orders.id
   FROM public.orders
  WHERE ((orders.customer_id = public.get_my_customer_id()) AND (orders.status = 'delivered'::public.order_status))))));


--
-- Name: reviews reviews_manage_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_manage_admin ON public.reviews TO authenticated USING (public.is_admin());


--
-- Name: reviews reviews_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_select_own ON public.reviews FOR SELECT TO authenticated USING ((customer_id = public.get_my_customer_id()));


--
-- Name: reviews reviews_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_select_public ON public.reviews FOR SELECT TO authenticated, anon USING ((is_visible = true));


--
-- Name: reviews reviews_update_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_update_customer ON public.reviews FOR UPDATE TO authenticated USING ((customer_id = public.get_my_customer_id())) WITH CHECK ((customer_id = public.get_my_customer_id()));


--
-- Name: site_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

--
-- Name: site_content site_content_manage_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_content_manage_admin ON public.site_content TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: site_content site_content_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_content_select_anon ON public.site_content FOR SELECT TO anon USING (true);


--
-- Name: site_content site_content_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_content_select_public ON public.site_content FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: waiter_order_history waiter_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waiter_history_insert ON public.waiter_order_history FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: waiter_order_history waiter_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waiter_history_select ON public.waiter_order_history FOR SELECT TO authenticated USING (((waiter_id = public.get_employee_id()) OR (EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.id = public.get_employee_id()) AND (e.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role])))))));


--
-- Name: waiter_order_history waiter_history_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waiter_history_update ON public.waiter_order_history FOR UPDATE TO authenticated USING ((waiter_id = public.get_employee_id())) WITH CHECK ((waiter_id = public.get_employee_id()));


--
-- Name: waiter_order_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waiter_order_history ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


