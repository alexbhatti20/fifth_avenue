-- =============================================
-- INVENTORY MANAGEMENT SYSTEM - COMPLETE RPC
-- =============================================
-- Run this SQL to update your database schema and functions

-- Step 1: Add missing columns to inventory table
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
ADD COLUMN IF NOT EXISTS max_quantity DECIMAL(10,2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reorder_point DECIMAL(10,2) DEFAULT 10,
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7;

-- Create unique index on SKU
CREATE UNIQUE INDEX IF NOT EXISTS inventory_sku_unique ON inventory(sku) WHERE sku IS NOT NULL;

-- Step 2: Update inventory_transactions table
ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS quantity_change DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);

-- Update type column to transaction_type if they're different
UPDATE inventory_transactions SET transaction_type = type WHERE transaction_type IS NULL AND type IS NOT NULL;
UPDATE inventory_transactions SET quantity_change = quantity WHERE quantity_change IS NULL;

-- Step 3: Create suppliers table if not exists
CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  payment_terms VARCHAR(255),
  lead_time_days INTEGER DEFAULT 7,
  rating DECIMAL(2,1),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create inventory categories table
CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES public.inventory_categories(id),
  color VARCHAR(20),
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO public.inventory_categories (name, description, color, icon, sort_order) VALUES
('meat', 'Meat & Poultry', '#ef4444', 'drumstick', 1),
('vegetables', 'Fresh Vegetables', '#22c55e', 'carrot', 2),
('dairy', 'Dairy Products', '#3b82f6', 'milk', 3),
('spices', 'Spices & Seasonings', '#f59e0b', 'pepper', 4),
('oils', 'Oils & Fats', '#eab308', 'droplet', 5),
('packaging', 'Packaging Materials', '#6b7280', 'box', 6),
('beverages', 'Beverages', '#06b6d4', 'cup', 7),
('grains', 'Grains & Rice', '#a855f7', 'wheat', 8),
('sauces', 'Sauces & Condiments', '#ec4899', 'sauce', 9),
('frozen', 'Frozen Items', '#0ea5e9', 'snowflake', 10),
('other', 'Other Items', '#64748b', 'box', 99)
ON CONFLICT (name) DO NOTHING;

-- Step 5: Create purchase orders table
CREATE TABLE IF NOT EXISTS public.inventory_purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.inventory_suppliers(id),
  supplier_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'ordered', 'partial', 'received', 'cancelled')),
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  shipping DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  expected_date DATE,
  received_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.employees(id),
  approved_by UUID REFERENCES public.employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Create stock alerts table
CREATE TABLE IF NOT EXISTS public.inventory_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'expiring', 'expired', 'overstock')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES public.employees(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Get employee ID helper
CREATE OR REPLACE FUNCTION get_employee_id()
RETURNS UUID AS $$
DECLARE
    emp_id UUID;
BEGIN
    SELECT id INTO emp_id
    FROM employees
    WHERE auth_user_id = auth.uid()
    AND status = 'active';
    
    RETURN emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if manager or admin
CREATE OR REPLACE FUNCTION is_manager_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_user_id = auth.uid() 
        AND status = 'active'
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INVENTORY CRUD FUNCTIONS
-- =============================================

-- Get all inventory items with comprehensive details
DROP FUNCTION IF EXISTS get_inventory_items();
CREATE OR REPLACE FUNCTION get_inventory_items()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new inventory item
DROP FUNCTION IF EXISTS create_inventory_item(TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT);
CREATE OR REPLACE FUNCTION create_inventory_item(
    p_name TEXT,
    p_sku TEXT DEFAULT NULL,
    p_category TEXT DEFAULT 'other',
    p_unit TEXT DEFAULT 'pcs',
    p_quantity DECIMAL(10,2) DEFAULT 0,
    p_min_quantity DECIMAL(10,2) DEFAULT 10,
    p_max_quantity DECIMAL(10,2) DEFAULT 100,
    p_cost_per_unit DECIMAL(10,2) DEFAULT 0,
    p_supplier TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_barcode TEXT DEFAULT NULL,
    p_expiry_date DATE DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update inventory item
DROP FUNCTION IF EXISTS update_inventory_item(UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT);
CREATE OR REPLACE FUNCTION update_inventory_item(
    p_item_id UUID,
    p_name TEXT DEFAULT NULL,
    p_sku TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unit TEXT DEFAULT NULL,
    p_min_quantity DECIMAL(10,2) DEFAULT NULL,
    p_max_quantity DECIMAL(10,2) DEFAULT NULL,
    p_cost_per_unit DECIMAL(10,2) DEFAULT NULL,
    p_supplier TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_barcode TEXT DEFAULT NULL,
    p_expiry_date DATE DEFAULT NULL,
    p_reorder_point DECIMAL(10,2) DEFAULT NULL,
    p_lead_time_days INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adjust inventory stock
DROP FUNCTION IF EXISTS adjust_inventory_stock(UUID, TEXT, DECIMAL, TEXT, DECIMAL);
CREATE OR REPLACE FUNCTION adjust_inventory_stock(
    p_item_id UUID,
    p_transaction_type TEXT,
    p_quantity DECIMAL(10,2),
    p_reason TEXT DEFAULT NULL,
    p_unit_cost DECIMAL(10,2) DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_batch_number TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
    
    -- Log transaction
    INSERT INTO inventory_transactions (
        inventory_id, transaction_type, quantity_change,
        unit_cost, total_cost, notes, created_by, 
        reference_number, batch_number, created_at
    ) VALUES (
        p_item_id,
        p_transaction_type,
        qty_change,
        actual_cost,
        ABS(qty_change) * actual_cost,
        p_reason,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get inventory transactions
DROP FUNCTION IF EXISTS get_inventory_transactions(UUID, DATE, DATE, INTEGER);
CREATE OR REPLACE FUNCTION get_inventory_transactions(
    p_item_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_transaction_type TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete inventory item (soft delete)
DROP FUNCTION IF EXISTS delete_inventory_item(UUID);
CREATE OR REPLACE FUNCTION delete_inventory_item(p_item_id UUID)
RETURNS JSON AS $$
BEGIN
    -- Soft delete - just mark as inactive
    UPDATE inventory SET is_active = false, updated_at = NOW() WHERE id = p_item_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hard delete inventory item (admin only)
CREATE OR REPLACE FUNCTION hard_delete_inventory_item(p_item_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INVENTORY REPORTS & ANALYTICS
-- =============================================

-- Get inventory summary/dashboard stats
CREATE OR REPLACE FUNCTION get_inventory_summary()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get low stock items for reordering
CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get inventory movement report
CREATE OR REPLACE FUNCTION get_inventory_movement_report(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get expiring items
CREATE OR REPLACE FUNCTION get_expiring_items(p_days INTEGER DEFAULT 30)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SUPPLIER MANAGEMENT
-- =============================================

CREATE OR REPLACE FUNCTION get_inventory_suppliers()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_inventory_supplier(
    p_name TEXT,
    p_contact_person TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_payment_terms TEXT DEFAULT NULL,
    p_lead_time_days INTEGER DEFAULT 7,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ALERTS MANAGEMENT
-- =============================================

CREATE OR REPLACE FUNCTION get_inventory_alerts(p_unread_only BOOLEAN DEFAULT true)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_inventory_alert_read(p_alert_id UUID)
RETURNS JSON AS $$
BEGIN
    UPDATE inventory_alerts SET is_read = true WHERE id = p_alert_id;
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION resolve_inventory_alert(p_alert_id UUID)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
BEGIN
    emp_id := get_employee_id();
    
    UPDATE inventory_alerts 
    SET is_resolved = true, resolved_by = emp_id, resolved_at = NOW()
    WHERE id = p_alert_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- BATCH OPERATIONS
-- =============================================

-- Bulk stock update (for inventory counts)
CREATE OR REPLACE FUNCTION bulk_update_stock(p_items JSONB)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate auto reorder suggestions
CREATE OR REPLACE FUNCTION generate_reorder_suggestions()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get inventory value by category
CREATE OR REPLACE FUNCTION get_inventory_value_by_category()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on tables
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;

-- Inventory policies
DROP POLICY IF EXISTS "Employees can view inventory" ON inventory;
CREATE POLICY "Employees can view inventory" ON inventory
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM employees WHERE auth_user_id = auth.uid() AND status = 'active')
    );

DROP POLICY IF EXISTS "Managers can manage inventory" ON inventory;
CREATE POLICY "Managers can manage inventory" ON inventory
    FOR ALL USING (
        EXISTS (SELECT 1 FROM employees WHERE auth_user_id = auth.uid() AND status = 'active' AND role IN ('admin', 'manager'))
    );

-- Transaction policies
DROP POLICY IF EXISTS "Employees can view transactions" ON inventory_transactions;
CREATE POLICY "Employees can view transactions" ON inventory_transactions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM employees WHERE auth_user_id = auth.uid() AND status = 'active')
    );

DROP POLICY IF EXISTS "Employees can insert transactions" ON inventory_transactions;
CREATE POLICY "Employees can insert transactions" ON inventory_transactions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM employees WHERE auth_user_id = auth.uid() AND status = 'active')
    );

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_inventory_items() TO authenticated;
GRANT EXECUTE ON FUNCTION create_inventory_item(TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION update_inventory_item(UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT, TEXT, TEXT, DATE, DECIMAL, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_inventory_stock(UUID, TEXT, DECIMAL, TEXT, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_transactions(UUID, DATE, DATE, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_inventory_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_items() TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_movement_report(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_expiring_items(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_suppliers() TO authenticated;
GRANT EXECUTE ON FUNCTION create_inventory_supplier(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_alerts(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_inventory_alert_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_inventory_alert(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_reorder_suggestions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_value_by_category() TO authenticated;
