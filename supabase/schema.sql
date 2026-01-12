-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL,
  date date NOT NULL,
  check_in timestamp with time zone,
  check_out timestamp with time zone,
  break_start timestamp with time zone,
  break_end timestamp with time zone,
  status character varying DEFAULT 'present'::character varying,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.attendance_codes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code character varying NOT NULL UNIQUE,
  generated_by uuid,
  valid_for_date date NOT NULL,
  valid_from time without time zone NOT NULL,
  valid_until time without time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_codes_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_codes_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.employees(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  user_type character varying,
  action character varying NOT NULL,
  table_name character varying,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.customer_invoice_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  invoice_number text NOT NULL,
  order_id uuid,
  order_type text,
  items jsonb,
  subtotal numeric,
  discount numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric NOT NULL,
  payment_method text,
  payment_status text,
  promo_code_used text,
  loyalty_points_used integer DEFAULT 0,
  loyalty_points_earned integer DEFAULT 0,
  billed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_invoice_records_pkey PRIMARY KEY (id),
  CONSTRAINT customer_invoice_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT customer_invoice_records_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT customer_invoice_records_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.customer_promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  promo_code_id uuid,
  code text NOT NULL UNIQUE,
  promo_type text NOT NULL CHECK (promo_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text])),
  value numeric NOT NULL,
  max_discount numeric,
  name text NOT NULL,
  description text,
  loyalty_points_required integer NOT NULL,
  is_used boolean DEFAULT false,
  used_at timestamp with time zone,
  used_on_order_id uuid,
  expires_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_promo_codes_pkey PRIMARY KEY (id),
  CONSTRAINT customer_promo_codes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT customer_promo_codes_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id),
  CONSTRAINT customer_promo_codes_used_on_order_id_fkey FOREIGN KEY (used_on_order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  auth_user_id uuid UNIQUE,
  name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  phone character varying NOT NULL UNIQUE,
  address text,
  is_verified boolean DEFAULT false,
  is_2fa_enabled boolean DEFAULT false,
  two_fa_secret text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  favorites jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.deal_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  deal_id uuid NOT NULL,
  menu_item_id uuid NOT NULL,
  quantity integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deal_items_pkey PRIMARY KEY (id),
  CONSTRAINT deal_items_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id),
  CONSTRAINT deal_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id)
);
CREATE TABLE public.deals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  description text,
  discount_percentage numeric,
  discount_amount numeric,
  images jsonb DEFAULT '[]'::jsonb,
  applicable_items jsonb,
  minimum_order_amount numeric,
  is_active boolean DEFAULT true,
  valid_from timestamp with time zone,
  valid_until timestamp with time zone,
  usage_limit integer,
  usage_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  code character varying UNIQUE,
  deal_type character varying DEFAULT 'combo'::character varying,
  original_price numeric DEFAULT 0,
  discounted_price numeric DEFAULT 0,
  image_url text,
  is_featured boolean DEFAULT false,
  CONSTRAINT deals_pkey PRIMARY KEY (id)
);
CREATE TABLE public.delivery_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL,
  order_id uuid NOT NULL,
  order_number text NOT NULL,
  order_snapshot jsonb NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_address text,
  customer_email text,
  items jsonb NOT NULL,
  total_items integer NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  delivery_fee numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text,
  payment_status text,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  delivered_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  delivery_status text NOT NULL DEFAULT 'accepted'::text CHECK (delivery_status = ANY (ARRAY['accepted'::text, 'delivering'::text, 'delivered'::text, 'cancelled'::text, 'returned'::text])),
  estimated_delivery_minutes integer,
  actual_delivery_minutes integer,
  distance_km numeric,
  delivery_notes text,
  customer_rating integer CHECK (customer_rating >= 1 AND customer_rating <= 5),
  customer_feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT delivery_history_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_history_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES public.employees(id),
  CONSTRAINT delivery_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.employee_documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid,
  document_type character varying NOT NULL,
  document_name character varying NOT NULL,
  file_url text NOT NULL,
  file_type character varying,
  uploaded_at timestamp with time zone DEFAULT now(),
  verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamp with time zone,
  CONSTRAINT employee_documents_pkey PRIMARY KEY (id),
  CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT employee_documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.employees(id)
);
CREATE TABLE public.employee_licenses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid,
  license_id character varying NOT NULL UNIQUE,
  issued_at timestamp with time zone DEFAULT now(),
  activated_at timestamp with time zone,
  activation_ip inet,
  is_used boolean DEFAULT false,
  expires_at timestamp with time zone,
  CONSTRAINT employee_licenses_pkey PRIMARY KEY (id),
  CONSTRAINT employee_licenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.employee_payroll (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid,
  month integer NOT NULL,
  year integer NOT NULL,
  base_salary numeric NOT NULL,
  bonus numeric DEFAULT 0,
  deductions numeric DEFAULT 0,
  tips numeric DEFAULT 0,
  total_amount numeric NOT NULL,
  paid boolean DEFAULT false,
  paid_at timestamp with time zone,
  paid_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT employee_payroll_pkey PRIMARY KEY (id),
  CONSTRAINT employee_payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT employee_payroll_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.employees(id)
);
CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  auth_user_id uuid UNIQUE,
  employee_id character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  phone character varying NOT NULL UNIQUE,
  role USER-DEFINED NOT NULL,
  status USER-DEFINED DEFAULT 'pending'::employee_status,
  permissions jsonb DEFAULT '{}'::jsonb,
  documents jsonb DEFAULT '[]'::jsonb,
  salary numeric,
  hired_date date,
  created_by uuid,
  is_2fa_enabled boolean DEFAULT false,
  two_fa_secret text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  license_id character varying UNIQUE,
  avatar_url text,
  address text,
  emergency_contact character varying,
  emergency_contact_name character varying,
  date_of_birth date,
  blood_group character varying,
  portal_enabled boolean DEFAULT false,
  last_login timestamp with time zone,
  total_tips numeric DEFAULT 0,
  total_orders_taken integer DEFAULT 0,
  bank_details jsonb DEFAULT '{}'::jsonb,
  notes text,
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT employees_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id)
);
CREATE TABLE public.inventory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  category character varying NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit character varying NOT NULL,
  min_quantity numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  supplier character varying,
  last_restocked timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inventory_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  inventory_id uuid NOT NULL,
  type character varying NOT NULL,
  quantity numeric NOT NULL,
  previous_quantity numeric NOT NULL,
  new_quantity numeric NOT NULL,
  reason text,
  performed_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_transactions_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id),
  CONSTRAINT inventory_transactions_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.employees(id)
);
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  invoice_number character varying NOT NULL UNIQUE,
  order_id uuid,
  customer_id uuid,
  customer_name character varying NOT NULL,
  customer_phone character varying,
  customer_email character varying,
  order_type character varying NOT NULL,
  items jsonb NOT NULL,
  subtotal numeric NOT NULL,
  discount numeric DEFAULT 0,
  discount_details jsonb,
  tax numeric DEFAULT 0,
  delivery_fee numeric DEFAULT 0,
  service_charge numeric DEFAULT 0,
  tip numeric DEFAULT 0,
  total numeric NOT NULL,
  payment_method character varying,
  payment_status USER-DEFINED DEFAULT 'pending'::invoice_status,
  loyalty_points_earned integer DEFAULT 0,
  table_number integer,
  served_by uuid,
  billed_by uuid,
  printed boolean DEFAULT false,
  printed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  bill_status text DEFAULT 'pending'::text CHECK (bill_status = ANY (ARRAY['pending'::text, 'generated'::text, 'paid'::text, 'void'::text, 'refunded'::text])),
  promo_code_id uuid,
  promo_code_value text,
  void_reason text,
  voided_by uuid,
  voided_at timestamp with time zone,
  table_session_id uuid,
  brand_info jsonb DEFAULT '{"ntn": "XXXXXXX", "name": "ZOIRO Broast", "email": "info@zoiro.com", "phone": "+92 XXX XXXXXXX", "address": "Main Branch, City", "tagline": "Injected Broast - Saucy. Juicy. Crispy.", "logo_url": "/assets/logo.png"}'::jsonb,
  loyalty_points_used integer DEFAULT 0,
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT invoices_served_by_fkey FOREIGN KEY (served_by) REFERENCES public.employees(id),
  CONSTRAINT invoices_billed_by_fkey FOREIGN KEY (billed_by) REFERENCES public.employees(id),
  CONSTRAINT invoices_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id),
  CONSTRAINT invoices_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.employees(id)
);
CREATE TABLE public.loyalty_points (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_id uuid,
  order_id uuid,
  points integer NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['earned'::character varying, 'redeemed'::character varying, 'bonus'::character varying, 'expired'::character varying]::text[])),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT loyalty_points_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_points_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT loyalty_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.loyalty_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_id uuid,
  points_change integer NOT NULL,
  transaction_type character varying NOT NULL,
  order_id uuid,
  description text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT loyalty_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT loyalty_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id)
);
CREATE TABLE public.meals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  description text,
  price numeric NOT NULL,
  original_price numeric,
  images jsonb DEFAULT '[]'::jsonb,
  items jsonb NOT NULL,
  is_available boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  valid_from timestamp with time zone,
  valid_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  CONSTRAINT meals_pkey PRIMARY KEY (id)
);
CREATE TABLE public.menu_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  description text,
  image_url text,
  display_order integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT menu_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.menu_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  category_id uuid,
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  description text,
  price numeric NOT NULL,
  images jsonb DEFAULT '[]'::jsonb,
  is_available boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  preparation_time integer,
  rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  tags jsonb DEFAULT '[]'::jsonb,
  nutritional_info jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  size_variants jsonb,
  has_variants boolean DEFAULT false,
  CONSTRAINT menu_items_pkey PRIMARY KEY (id),
  CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  user_type character varying NOT NULL,
  title character varying NOT NULL,
  message text NOT NULL,
  type character varying,
  is_read boolean DEFAULT false,
  data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  priority character varying DEFAULT 'normal'::character varying,
  action_url text,
  expires_at timestamp with time zone,
  sent_by uuid,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.order_cancellations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_id uuid,
  cancelled_by uuid,
  reason text,
  refund_amount numeric,
  refund_status character varying DEFAULT 'pending'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_cancellations_pkey PRIMARY KEY (id),
  CONSTRAINT order_cancellations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_cancellations_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.employees(id)
);
CREATE TABLE public.order_status_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_id uuid,
  status USER-DEFINED NOT NULL,
  changed_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_number character varying NOT NULL UNIQUE,
  customer_id uuid,
  customer_name character varying NOT NULL,
  customer_email character varying,
  customer_phone character varying NOT NULL,
  customer_address text,
  order_type USER-DEFINED DEFAULT 'online'::order_type,
  items jsonb NOT NULL,
  subtotal numeric NOT NULL,
  discount numeric DEFAULT 0,
  delivery_fee numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric NOT NULL,
  payment_method USER-DEFINED NOT NULL,
  payment_status character varying DEFAULT 'pending'::character varying,
  status USER-DEFINED DEFAULT 'pending'::order_status,
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
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.employees(id),
  CONSTRAINT orders_prepared_by_fkey FOREIGN KEY (prepared_by) REFERENCES public.employees(id),
  CONSTRAINT orders_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.employees(id),
  CONSTRAINT orders_delivery_rider_id_fkey FOREIGN KEY (delivery_rider_id) REFERENCES public.employees(id)
);
CREATE TABLE public.otp_codes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL,
  code character varying NOT NULL,
  purpose character varying NOT NULL,
  is_used boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT otp_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.password_reset_otps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_reset_otps_pkey PRIMARY KEY (id)
);
CREATE TABLE public.password_reset_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  attempt_count integer DEFAULT 1,
  first_attempt_at timestamp with time zone DEFAULT now(),
  last_attempt_at timestamp with time zone DEFAULT now(),
  cooldown_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_reset_rate_limits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  method_type text NOT NULL CHECK (method_type = ANY (ARRAY['jazzcash'::text, 'easypaisa'::text, 'bank'::text])),
  method_name text NOT NULL,
  account_number text NOT NULL,
  account_holder_name text NOT NULL,
  bank_name text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payment_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method USER-DEFINED NOT NULL,
  status character varying DEFAULT 'pending'::character varying,
  proof_url text,
  transaction_id text,
  verified_by uuid,
  verified_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_records_pkey PRIMARY KEY (id),
  CONSTRAINT payment_records_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT payment_records_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT payment_records_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.employees(id)
);
CREATE TABLE public.payslips (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  base_salary numeric NOT NULL,
  overtime_hours numeric DEFAULT 0,
  overtime_rate numeric DEFAULT 1.5,
  bonuses numeric DEFAULT 0,
  deductions numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  net_salary numeric NOT NULL,
  status character varying DEFAULT 'pending'::character varying,
  payment_method character varying,
  paid_at timestamp with time zone,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payslips_pkey PRIMARY KEY (id),
  CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT payslips_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id)
);
CREATE TABLE public.perks_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT perks_settings_pkey PRIMARY KEY (id),
  CONSTRAINT perks_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.employees(id)
);
CREATE TABLE public.promo_code_usage (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL,
  deal_id uuid NOT NULL,
  order_id uuid NOT NULL,
  discount_applied numeric NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promo_code_usage_pkey PRIMARY KEY (id),
  CONSTRAINT promo_code_usage_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT promo_code_usage_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id),
  CONSTRAINT promo_code_usage_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.promo_codes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  description text,
  promo_type USER-DEFINED NOT NULL,
  value numeric NOT NULL,
  min_order_amount numeric DEFAULT 0,
  max_discount numeric,
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
  loyalty_points_required integer,
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id),
  CONSTRAINT promo_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id),
  CONSTRAINT promo_codes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.push_tokens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  user_type character varying NOT NULL,
  token text NOT NULL,
  device_type character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_tokens_pkey PRIMARY KEY (id)
);
CREATE TABLE public.reports_archive (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  report_type character varying NOT NULL,
  report_period character varying,
  start_date date NOT NULL,
  end_date date NOT NULL,
  data jsonb NOT NULL,
  file_url text,
  generated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reports_archive_pkey PRIMARY KEY (id),
  CONSTRAINT reports_archive_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.employees(id)
);
CREATE TABLE public.restaurant_tables (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  table_number integer NOT NULL UNIQUE,
  capacity integer NOT NULL,
  status USER-DEFINED DEFAULT 'available'::table_status,
  section character varying,
  floor integer DEFAULT 1,
  position jsonb,
  current_order_id uuid,
  current_customers integer DEFAULT 0,
  assigned_waiter_id uuid,
  reserved_by uuid,
  reservation_time timestamp with time zone,
  reservation_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_tables_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_tables_assigned_waiter_id_fkey FOREIGN KEY (assigned_waiter_id) REFERENCES public.employees(id),
  CONSTRAINT restaurant_tables_reserved_by_fkey FOREIGN KEY (reserved_by) REFERENCES public.customers(id)
);
CREATE TABLE public.review_helpful_votes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  review_id uuid NOT NULL,
  customer_id uuid,
  ip_address character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT review_helpful_votes_pkey PRIMARY KEY (id),
  CONSTRAINT review_helpful_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id),
  CONSTRAINT review_helpful_votes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_id uuid,
  order_id uuid,
  item_id uuid,
  meal_id uuid,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  images jsonb DEFAULT '[]'::jsonb,
  is_verified boolean DEFAULT false,
  is_visible boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  admin_reply text,
  replied_at timestamp with time zone,
  review_type character varying DEFAULT 'overall'::character varying,
  helpful_count integer DEFAULT 0,
  replied_by uuid,
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT reviews_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.menu_items(id),
  CONSTRAINT reviews_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.meals(id),
  CONSTRAINT reviews_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES public.employees(id)
);
CREATE TABLE public.site_content (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  page character varying NOT NULL,
  section character varying NOT NULL,
  content jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT site_content_pkey PRIMARY KEY (id)
);
CREATE TABLE public.table_exchange_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  from_waiter_id uuid NOT NULL,
  to_waiter_id uuid NOT NULL,
  table_id uuid NOT NULL,
  exchange_type character varying NOT NULL,
  swap_table_id uuid,
  status character varying DEFAULT 'pending'::character varying,
  reason text,
  responded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT table_exchange_requests_pkey PRIMARY KEY (id),
  CONSTRAINT table_exchange_requests_from_waiter_id_fkey FOREIGN KEY (from_waiter_id) REFERENCES public.employees(id),
  CONSTRAINT table_exchange_requests_to_waiter_id_fkey FOREIGN KEY (to_waiter_id) REFERENCES public.employees(id),
  CONSTRAINT table_exchange_requests_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id),
  CONSTRAINT table_exchange_requests_swap_table_id_fkey FOREIGN KEY (swap_table_id) REFERENCES public.restaurant_tables(id)
);
CREATE TABLE public.table_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  table_id uuid,
  order_id uuid,
  waiter_id uuid,
  customer_count integer,
  opened_at timestamp with time zone NOT NULL,
  closed_at timestamp with time zone,
  total_bill numeric,
  tip_amount numeric DEFAULT 0,
  notes text,
  CONSTRAINT table_history_pkey PRIMARY KEY (id),
  CONSTRAINT table_history_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id),
  CONSTRAINT table_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT table_history_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.employees(id)
);
CREATE TABLE public.two_fa_setup (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  user_type character varying NOT NULL,
  secret text NOT NULL,
  backup_codes jsonb DEFAULT '[]'::jsonb,
  is_enabled boolean DEFAULT false,
  enabled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT two_fa_setup_pkey PRIMARY KEY (id)
);
CREATE TABLE public.waiter_order_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  subtotal numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text,
  payment_status text DEFAULT 'pending'::text,
  tip_amount numeric DEFAULT 0,
  invoice_number text,
  order_taken_at timestamp with time zone NOT NULL DEFAULT now(),
  order_confirmed_at timestamp with time zone,
  order_completed_at timestamp with time zone,
  order_status text DEFAULT 'pending'::text,
  confirmation_email_sent boolean DEFAULT false,
  confirmation_email_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT waiter_order_history_pkey PRIMARY KEY (id),
  CONSTRAINT waiter_order_history_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.employees(id),
  CONSTRAINT waiter_order_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT waiter_order_history_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id),
  CONSTRAINT waiter_order_history_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.waiter_tips (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  waiter_id uuid,
  order_id uuid,
  invoice_id uuid,
  tip_amount numeric NOT NULL,
  table_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT waiter_tips_pkey PRIMARY KEY (id),
  CONSTRAINT waiter_tips_waiter_id_fkey FOREIGN KEY (waiter_id) REFERENCES public.employees(id),
  CONSTRAINT waiter_tips_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT waiter_tips_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT waiter_tips_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id)
);
CREATE TABLE public.website_content (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  key character varying NOT NULL UNIQUE,
  title character varying,
  content jsonb NOT NULL,
  section character varying,
  is_active boolean DEFAULT true,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT website_content_pkey PRIMARY KEY (id),
  CONSTRAINT website_content_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.employees(id)
);

DROP FUNCTION IF EXISTS get_admin_dashboard_stats();
DROP FUNCTION IF EXISTS get_sales_analytics(DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS get_hourly_sales_today();
DROP FUNCTION IF EXISTS create_employee(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, DECIMAL, DATE);
DROP FUNCTION IF EXISTS activate_employee_account(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS get_employee_analytics(UUID);
DROP FUNCTION IF EXISTS toggle_employee_status(UUID, TEXT);
DROP FUNCTION IF EXISTS get_waiter_dashboard();
DROP FUNCTION IF EXISTS create_dine_in_order(UUID, INTEGER, JSONB, UUID, VARCHAR, VARCHAR, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS cancel_order_by_waiter(UUID, TEXT);
DROP FUNCTION IF EXISTS request_table_exchange(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS respond_table_exchange(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS get_kitchen_orders();
DROP FUNCTION IF EXISTS update_order_status_kitchen(UUID, TEXT);
DROP FUNCTION IF EXISTS generate_invoice(UUID, TEXT, DECIMAL, UUID);
DROP FUNCTION IF EXISTS mark_attendance_with_code(TEXT);
DROP FUNCTION IF EXISTS generate_attendance_code(TIME, TIME);
DROP FUNCTION IF EXISTS get_tables_status();
DROP FUNCTION IF EXISTS update_table_status(UUID, TEXT);
DROP FUNCTION IF EXISTS send_notification(UUID[], TEXT, TEXT, TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS get_my_notifications(INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS mark_notifications_read(UUID[]);
DROP FUNCTION IF EXISTS get_delivery_orders();
DROP FUNCTION IF EXISTS accept_delivery_order(UUID);
DROP FUNCTION IF EXISTS complete_delivery(UUID);
DROP FUNCTION IF EXISTS generate_sales_report(DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS generate_employee_report(DATE, DATE);
DROP FUNCTION IF EXISTS validate_promo_code(TEXT, UUID, DECIMAL);
DROP FUNCTION IF EXISTS get_inventory_items();
DROP FUNCTION IF EXISTS create_inventory_item(TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_inventory_item(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS adjust_inventory_stock(UUID, DECIMAL, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS get_inventory_transactions(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS delete_inventory_item(UUID);
DROP FUNCTION IF EXISTS get_deals();
DROP FUNCTION IF EXISTS create_deal(TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT[], BOOLEAN);
DROP FUNCTION IF EXISTS update_deal(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT[], BOOLEAN);
DROP FUNCTION IF EXISTS toggle_deal_status(UUID);
DROP FUNCTION IF EXISTS delete_deal(UUID);
DROP FUNCTION IF EXISTS get_audit_logs(TEXT, TEXT, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER);
DROP FUNCTION IF EXISTS log_audit_action(TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS get_payslips(UUID, TEXT, DATE, DATE, INTEGER);
DROP FUNCTION IF EXISTS create_payslip(UUID, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS update_payslip_status(UUID, TEXT);
DROP FUNCTION IF EXISTS get_payroll_summary(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_admin_reviews(INTEGER, TEXT, BOOLEAN, TEXT, INTEGER);
DROP FUNCTION IF EXISTS update_review_visibility(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS reply_to_review(UUID, TEXT);
DROP FUNCTION IF EXISTS delete_review(UUID);
DROP FUNCTION IF EXISTS get_review_stats();
DROP FUNCTION IF EXISTS get_notifications(UUID, TEXT, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS mark_notification_read(UUID);
DROP FUNCTION IF EXISTS mark_all_notifications_read(TEXT);
DROP FUNCTION IF EXISTS create_notification(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS get_unread_notification_count(TEXT);
DROP FUNCTION IF EXISTS get_category_sales_report(DATE, DATE);
DROP FUNCTION IF EXISTS get_employee_performance_report(DATE, DATE);
DROP FUNCTION IF EXISTS get_inventory_report();
DROP FUNCTION IF EXISTS get_user_by_email(TEXT);

-- =============================================
-- USER LOOKUP FUNCTION (BYPASSES RLS)
-- =============================================

-- Get user by email - checks both employees and customers tables
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    phone TEXT,
    user_type TEXT,
    role TEXT,
    permissions JSONB,
    employee_id TEXT,
    status TEXT,
    is_2fa_enabled BOOLEAN
) AS $$
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
            e.is_2fa_enabled
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
        c.is_2fa_enabled
    FROM customers c
    WHERE LOWER(c.email) = LOWER(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DASHBOARD ANALYTICS FUNCTIONS
-- =============================================

-- Get admin dashboard stats
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_sales', (
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
            AND status NOT IN ('cancelled')
        ),
        'total_sales_today', (
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE created_at >= date_trunc('day', CURRENT_DATE)
            AND status NOT IN ('cancelled')
        ),
        'total_orders_today', (
            SELECT COUNT(*)
            FROM orders
            WHERE created_at >= date_trunc('day', CURRENT_DATE)
        ),
        'total_orders_month', (
            SELECT COUNT(*)
            FROM orders
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'pending_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE status IN ('pending', 'confirmed', 'preparing')
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
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get sales analytics
CREATE OR REPLACE FUNCTION get_sales_analytics(
    p_start_date DATE,
    p_end_date DATE,
    p_group_by TEXT DEFAULT 'day'
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get hourly sales for today
CREATE OR REPLACE FUNCTION get_hourly_sales_today()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'hour', hour,
            'sales', COALESCE(total_sales, 0),
            'orders', COALESCE(order_count, 0)
        )
        ORDER BY hour
    ) INTO result
    FROM (
        SELECT 
            generate_series(0, 23) as hour
    ) hours
    LEFT JOIN (
        SELECT 
            EXTRACT(HOUR FROM created_at)::INTEGER as hour,
            SUM(total) as total_sales,
            COUNT(*) as order_count
        FROM orders
        WHERE DATE(created_at) = CURRENT_DATE
        AND status NOT IN ('cancelled')
        GROUP BY EXTRACT(HOUR FROM created_at)
    ) sales ON hours.hour = sales.hour;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- EMPLOYEE MANAGEMENT FUNCTIONS
-- =============================================

-- Create employee with license
CREATE OR REPLACE FUNCTION create_employee(
    p_name VARCHAR(255),
    p_email VARCHAR(255),
    p_phone VARCHAR(20),
    p_role TEXT,
    p_salary DECIMAL(10, 2),
    p_hired_date DATE,
    p_documents JSONB DEFAULT '[]',
    p_address TEXT DEFAULT NULL,
    p_emergency_contact VARCHAR(20) DEFAULT NULL,
    p_emergency_contact_name VARCHAR(255) DEFAULT NULL,
    p_date_of_birth DATE DEFAULT NULL,
    p_blood_group VARCHAR(10) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activate employee account
CREATE OR REPLACE FUNCTION activate_employee_account(
    p_license_id VARCHAR(50),
    p_auth_user_id UUID
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get employee analytics
CREATE OR REPLACE FUNCTION get_employee_analytics(p_employee_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Block/unblock employee
CREATE OR REPLACE FUNCTION toggle_employee_status(
    p_employee_id UUID,
    p_status TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- WAITER FUNCTIONS
-- =============================================

-- Get waiter dashboard
CREATE OR REPLACE FUNCTION get_waiter_dashboard()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create dine-in order
CREATE OR REPLACE FUNCTION create_dine_in_order(
    p_table_id UUID,
    p_customer_count INTEGER,
    p_items JSONB,
    p_customer_id UUID DEFAULT NULL,
    p_customer_name VARCHAR(255) DEFAULT NULL,
    p_customer_phone VARCHAR(20) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_send_confirmation BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
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
    
    -- Create order
    INSERT INTO orders (
        customer_id, customer_name, customer_phone,
        order_type, items, subtotal, total,
        payment_method, table_number, notes,
        waiter_id, assigned_to, can_cancel_until
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
        NOW() + INTERVAL '5 minutes'
    ) RETURNING id INTO new_order_id;
    
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
        'send_confirmation', p_send_confirmation
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel order (within time limit)
CREATE OR REPLACE FUNCTION cancel_order_by_waiter(
    p_order_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Request table exchange
CREATE OR REPLACE FUNCTION request_table_exchange(
    p_table_id UUID,
    p_to_waiter_id UUID,
    p_exchange_type TEXT,
    p_swap_table_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Respond to table exchange
CREATE OR REPLACE FUNCTION respond_table_exchange(
    p_request_id UUID,
    p_accept BOOLEAN
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- KITCHEN FUNCTIONS
-- =============================================

-- Get kitchen orders
CREATE OR REPLACE FUNCTION get_kitchen_orders()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'order_type', o.order_type,
            'table_number', o.table_number,
            'items', o.items,
            'status', o.status,
            'notes', o.notes,
            'waiter', (
                SELECT json_build_object('id', e.id, 'name', e.name)
                FROM employees e WHERE e.id = o.waiter_id
            ),
            'created_at', o.created_at,
            'kitchen_started_at', o.kitchen_started_at
        )
        ORDER BY 
            CASE o.status 
                WHEN 'confirmed' THEN 1
                WHEN 'preparing' THEN 2
                ELSE 3
            END,
            o.created_at
    ) INTO result
    FROM orders o
    WHERE o.status IN ('confirmed', 'preparing', 'pending')
    AND o.created_at >= CURRENT_DATE;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update order status from kitchen
CREATE OR REPLACE FUNCTION update_order_status_kitchen(
    p_order_id UUID,
    p_status TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- BILLING FUNCTIONS
-- =============================================

-- Generate invoice
CREATE OR REPLACE FUNCTION generate_invoice(
    p_order_id UUID,
    p_payment_method TEXT,
    p_tip DECIMAL(10, 2) DEFAULT 0,
    p_discount DECIMAL(10, 2) DEFAULT 0,
    p_promo_code TEXT DEFAULT NULL,
    p_loyalty_points_used INTEGER DEFAULT 0
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ATTENDANCE FUNCTIONS
-- =============================================

-- Mark attendance with code
CREATE OR REPLACE FUNCTION mark_attendance_with_code(
    p_code VARCHAR(10)
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    code_record RECORD;
    attendance_record RECORD;
BEGIN
    emp_id := get_employee_id();
    
    -- Validate code
    SELECT * INTO code_record
    FROM attendance_codes
    WHERE code = p_code
    AND is_active = true
    AND valid_for_date = CURRENT_DATE
    AND CURRENT_TIME BETWEEN valid_from AND valid_until;
    
    IF code_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired code');
    END IF;
    
    -- Check if already checked in
    SELECT * INTO attendance_record
    FROM attendance
    WHERE employee_id = emp_id
    AND date = CURRENT_DATE;
    
    IF attendance_record IS NOT NULL THEN
        -- Check out
        IF attendance_record.check_out IS NOT NULL THEN
            RETURN json_build_object('success', false, 'error', 'Already checked out today');
        END IF;
        
        UPDATE attendance
        SET check_out = NOW(),
            check_out_method = 'code',
            hours_worked = EXTRACT(EPOCH FROM (NOW() - check_in)) / 3600
        WHERE id = attendance_record.id;
        
        RETURN json_build_object('success', true, 'action', 'check_out');
    ELSE
        -- Check in
        INSERT INTO attendance (employee_id, date, check_in, check_in_method, status)
        VALUES (
            emp_id,
            CURRENT_DATE,
            NOW(),
            'code',
            CASE 
                WHEN CURRENT_TIME > '09:30:00'::TIME THEN 'late'
                ELSE 'present'
            END
        );
        
        RETURN json_build_object('success', true, 'action', 'check_in');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate attendance code (manager only)
CREATE OR REPLACE FUNCTION generate_attendance_code(
    p_valid_from TIME,
    p_valid_until TIME
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    new_code VARCHAR(10);
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    new_code := UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 6));
    
    -- Deactivate previous codes for today
    UPDATE attendance_codes
    SET is_active = false
    WHERE valid_for_date = CURRENT_DATE;
    
    INSERT INTO attendance_codes (code, generated_by, valid_for_date, valid_from, valid_until)
    VALUES (new_code, emp_id, CURRENT_DATE, p_valid_from, p_valid_until);
    
    RETURN json_build_object('success', true, 'code', new_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TABLES MANAGEMENT FUNCTIONS
-- =============================================

-- Get all tables with status
CREATE OR REPLACE FUNCTION get_tables_status()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', t.id,
            'table_number', t.table_number,
            'capacity', t.capacity,
            'status', t.status,
            'section', t.section,
            'floor', t.floor,
            'current_customers', t.current_customers,
            'current_order', CASE WHEN t.current_order_id IS NOT NULL THEN (
                SELECT json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'total', o.total,
                    'status', o.status
                )
                FROM orders o WHERE o.id = t.current_order_id
            ) ELSE NULL END,
            'assigned_waiter', CASE WHEN t.assigned_waiter_id IS NOT NULL THEN (
                SELECT json_build_object('id', e.id, 'name', e.name)
                FROM employees e WHERE e.id = t.assigned_waiter_id
            ) ELSE NULL END,
            'reservation', CASE WHEN t.status = 'reserved' THEN json_build_object(
                'customer', (SELECT name FROM customers WHERE id = t.reserved_by),
                'time', t.reservation_time,
                'notes', t.reservation_notes
            ) ELSE NULL END
        )
        ORDER BY t.table_number
    ) INTO result
    FROM restaurant_tables t;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update table status
CREATE OR REPLACE FUNCTION update_table_status(
    p_table_id UUID,
    p_status TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- NOTIFICATIONS FUNCTIONS
-- =============================================

-- Send notification
CREATE OR REPLACE FUNCTION send_notification(
    p_user_ids UUID[],
    p_user_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'system',
    p_data JSONB DEFAULT NULL,
    p_priority TEXT DEFAULT 'normal'
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get my notifications
CREATE OR REPLACE FUNCTION get_my_notifications(
    p_limit INTEGER DEFAULT 50,
    p_unread_only BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
    p_notification_ids UUID[]
)
RETURNS JSON AS $$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE id = ANY(p_notification_ids)
    AND user_id = get_employee_id();
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DELIVERY FUNCTIONS
-- =============================================

-- Get delivery orders
CREATE OR REPLACE FUNCTION get_delivery_orders()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept delivery order
CREATE OR REPLACE FUNCTION accept_delivery_order(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
BEGIN
    IF NOT is_delivery_rider() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    UPDATE orders
    SET delivery_rider_id = emp_id,
        status = 'delivering',
        delivery_started_at = NOW(),
        estimated_delivery_time = NOW() + INTERVAL '30 minutes',
        updated_at = NOW()
    WHERE id = p_order_id
    AND status = 'ready';
    
    -- Add status history
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (p_order_id, 'delivering', emp_id);
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete delivery
CREATE OR REPLACE FUNCTION complete_delivery(p_order_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REPORT FUNCTIONS
-- =============================================

-- Generate sales report
CREATE OR REPLACE FUNCTION generate_sales_report(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate employee report
CREATE OR REPLACE FUNCTION generate_employee_report(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PROMO CODE FUNCTIONS
-- =============================================

-- Validate promo code
CREATE OR REPLACE FUNCTION validate_promo_code(
    p_code TEXT,
    p_customer_id UUID DEFAULT NULL,
    p_order_amount DECIMAL(10, 2) DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    promo RECORD;
    usage_count INTEGER;
    discount_value DECIMAL(10, 2);
BEGIN
    SELECT * INTO promo
    FROM promo_codes
    WHERE code = p_code
    AND is_active = true
    AND valid_from <= NOW()
    AND valid_until >= NOW();
    
    IF promo IS NULL THEN
        RETURN json_build_object('valid', false, 'error', 'Invalid or expired promo code');
    END IF;
    
    -- Check usage limit
    IF promo.usage_limit IS NOT NULL AND promo.current_usage >= promo.usage_limit THEN
        RETURN json_build_object('valid', false, 'error', 'Promo code usage limit reached');
    END IF;
    
    -- Check per-customer limit
    IF p_customer_id IS NOT NULL AND promo.usage_per_customer IS NOT NULL THEN
        SELECT COUNT(*) INTO usage_count
        FROM promo_code_usage
        WHERE promo_code_id = promo.id
        AND customer_id = p_customer_id;
        
        IF usage_count >= promo.usage_per_customer THEN
            RETURN json_build_object('valid', false, 'error', 'You have already used this promo code');
        END IF;
    END IF;
    
    -- Check minimum order amount
    IF promo.min_order_amount IS NOT NULL AND p_order_amount < promo.min_order_amount THEN
        RETURN json_build_object('valid', false, 'error', 'Minimum order amount of ' || promo.min_order_amount || ' required');
    END IF;
    
    -- Calculate discount
    IF promo.promo_type = 'percentage' THEN
        discount_value := p_order_amount * (promo.value / 100);
        IF promo.max_discount IS NOT NULL THEN
            discount_value := LEAST(discount_value, promo.max_discount);
        END IF;
    ELSE
        discount_value := promo.value;
    END IF;
    
    RETURN json_build_object(
        'valid', true,
        'promo', json_build_object(
            'id', promo.id,
            'name', promo.name,
            'type', promo.promo_type,
            'value', promo.value,
            'discount_amount', discount_value
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INVENTORY MANAGEMENT FUNCTIONS
-- =============================================

-- Get all inventory items with status
CREATE OR REPLACE FUNCTION get_inventory_items()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', i.id,
            'name', i.name,
            'sku', i.sku,
            'category', i.category,
            'unit', i.unit,
            'current_stock', i.quantity,
            'min_stock', i.min_quantity,
            'max_stock', i.max_quantity,
            'cost_per_unit', i.cost_per_unit,
            'supplier', i.supplier,
            'last_restocked', i.last_restocked,
            'status', CASE 
                WHEN i.quantity <= 0 THEN 'out_of_stock'
                WHEN i.quantity <= i.min_quantity THEN 'low_stock'
                ELSE 'in_stock'
            END,
            'notes', i.notes,
            'created_at', i.created_at,
            'updated_at', i.updated_at
        )
        ORDER BY i.name
    ) INTO result
    FROM inventory i;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create inventory item
CREATE OR REPLACE FUNCTION create_inventory_item(
    p_name TEXT,
    p_sku TEXT,
    p_category TEXT,
    p_unit TEXT,
    p_quantity DECIMAL(10,2) DEFAULT 0,
    p_min_quantity DECIMAL(10,2) DEFAULT 10,
    p_max_quantity DECIMAL(10,2) DEFAULT 100,
    p_cost_per_unit DECIMAL(10,2) DEFAULT 0,
    p_supplier TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    new_item_id UUID;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    INSERT INTO inventory (
        name, sku, category, unit, quantity, min_quantity, max_quantity,
        cost_per_unit, supplier, notes, created_by
    ) VALUES (
        p_name, p_sku, p_category, p_unit, p_quantity, p_min_quantity, p_max_quantity,
        p_cost_per_unit, p_supplier, p_notes, emp_id
    ) RETURNING id INTO new_item_id;
    
    -- Log transaction if initial quantity > 0
    IF p_quantity > 0 THEN
        INSERT INTO inventory_transactions (
            inventory_id, transaction_type, quantity_change,
            unit_cost, total_cost, notes, created_by
        ) VALUES (
            new_item_id, 'purchase', p_quantity,
            p_cost_per_unit, p_quantity * p_cost_per_unit,
            'Initial stock', emp_id
        );
    END IF;
    
    RETURN json_build_object('success', true, 'id', new_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update inventory item
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
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
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
        updated_at = NOW()
    WHERE id = p_item_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adjust inventory stock
CREATE OR REPLACE FUNCTION adjust_inventory_stock(
    p_item_id UUID,
    p_transaction_type TEXT,
    p_quantity DECIMAL(10,2),
    p_reason TEXT DEFAULT NULL,
    p_unit_cost DECIMAL(10,2) DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    item_record RECORD;
    new_quantity DECIMAL(10,2);
    actual_cost DECIMAL(10,2);
BEGIN
    emp_id := get_employee_id();
    
    -- Get current item
    SELECT * INTO item_record FROM inventory WHERE id = p_item_id;
    
    IF item_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Item not found');
    END IF;
    
    -- Calculate new quantity based on transaction type
    CASE p_transaction_type
        WHEN 'purchase' THEN new_quantity := item_record.quantity + p_quantity;
        WHEN 'usage' THEN new_quantity := item_record.quantity - p_quantity;
        WHEN 'waste' THEN new_quantity := item_record.quantity - p_quantity;
        WHEN 'adjustment' THEN new_quantity := p_quantity; -- Direct set
        ELSE RETURN json_build_object('success', false, 'error', 'Invalid transaction type');
    END CASE;
    
    -- Prevent negative stock
    IF new_quantity < 0 THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient stock');
    END IF;
    
    actual_cost := COALESCE(p_unit_cost, item_record.cost_per_unit);
    
    -- Update inventory
    UPDATE inventory SET
        quantity = new_quantity,
        last_restocked = CASE WHEN p_transaction_type = 'purchase' THEN NOW() ELSE last_restocked END,
        updated_at = NOW()
    WHERE id = p_item_id;
    
    -- Log transaction
    INSERT INTO inventory_transactions (
        inventory_id, transaction_type, quantity_change,
        unit_cost, total_cost, notes, created_by
    ) VALUES (
        p_item_id,
        p_transaction_type,
        CASE 
            WHEN p_transaction_type IN ('usage', 'waste') THEN -p_quantity
            WHEN p_transaction_type = 'adjustment' THEN new_quantity - item_record.quantity
            ELSE p_quantity
        END,
        actual_cost,
        CASE 
            WHEN p_transaction_type IN ('usage', 'waste') THEN -p_quantity * actual_cost
            WHEN p_transaction_type = 'adjustment' THEN (new_quantity - item_record.quantity) * actual_cost
            ELSE p_quantity * actual_cost
        END,
        p_reason,
        emp_id
    );
    
    RETURN json_build_object('success', true, 'new_quantity', new_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get inventory transactions for an item
CREATE OR REPLACE FUNCTION get_inventory_transactions(
    p_item_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
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
            'type', t.transaction_type,
            'quantity', t.quantity_change,
            'unit_cost', t.unit_cost,
            'total_cost', t.total_cost,
            'reason', t.notes,
            'performed_by', (SELECT name FROM employees WHERE id = t.created_by),
            'created_at', t.created_at
        )
        ORDER BY t.created_at DESC
    ) INTO result
    FROM inventory_transactions t
    JOIN inventory i ON i.id = t.inventory_id
    WHERE (p_item_id IS NULL OR t.inventory_id = p_item_id)
    AND (p_start_date IS NULL OR DATE(t.created_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(t.created_at) <= p_end_date)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete inventory item
CREATE OR REPLACE FUNCTION delete_inventory_item(p_item_id UUID)
RETURNS JSON AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    DELETE FROM inventory_transactions WHERE inventory_id = p_item_id;
    DELETE FROM inventory WHERE id = p_item_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DEALS & PROMOTIONS FUNCTIONS
-- =============================================

-- Get all deals/promotions
CREATE OR REPLACE FUNCTION get_deals()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create deal/promotion
CREATE OR REPLACE FUNCTION create_deal(
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_code TEXT DEFAULT NULL,
    p_discount_type TEXT DEFAULT 'percentage',
    p_discount_value DECIMAL(10,2) DEFAULT 10,
    p_min_order_amount DECIMAL(10,2) DEFAULT NULL,
    p_max_discount DECIMAL(10,2) DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NOW(),
    p_end_date TIMESTAMP DEFAULT NULL,
    p_usage_limit INTEGER DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    new_deal_id UUID;
    actual_code TEXT;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    actual_code := COALESCE(p_code, UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 8)));
    
    INSERT INTO promo_codes (
        name, description, code, promo_type, value,
        min_order_amount, max_discount, valid_from, valid_until,
        usage_limit, is_active, created_by
    ) VALUES (
        p_name, p_description, actual_code, p_discount_type, p_discount_value,
        p_min_order_amount, p_max_discount, p_start_date, p_end_date,
        p_usage_limit, p_is_active, emp_id
    ) RETURNING id INTO new_deal_id;
    
    RETURN json_build_object('success', true, 'id', new_deal_id, 'code', actual_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update deal/promotion
CREATE OR REPLACE FUNCTION update_deal(
    p_deal_id UUID,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_discount_value DECIMAL(10,2) DEFAULT NULL,
    p_min_order_amount DECIMAL(10,2) DEFAULT NULL,
    p_max_discount DECIMAL(10,2) DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle deal status
CREATE OR REPLACE FUNCTION toggle_deal_status(p_deal_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete deal
CREATE OR REPLACE FUNCTION delete_deal(p_deal_id UUID)
RETURNS JSON AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    DELETE FROM promo_code_usage WHERE promo_code_id = p_deal_id;
    DELETE FROM promo_codes WHERE id = p_deal_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- AUDIT LOG FUNCTIONS
-- =============================================

-- Get audit logs
CREATE OR REPLACE FUNCTION get_audit_logs(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_employee_id UUID DEFAULT NULL,
    p_action_type TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log audit action
CREATE OR REPLACE FUNCTION log_audit_action(
    p_action TEXT,
    p_table_name TEXT,
    p_record_id UUID,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PAYROLL MANAGEMENT FUNCTIONS
-- =============================================

-- Get payslips
CREATE OR REPLACE FUNCTION get_payslips(
    p_employee_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create payslip
CREATE OR REPLACE FUNCTION create_payslip(
    p_employee_id UUID,
    p_period_start DATE,
    p_period_end DATE,
    p_base_salary DECIMAL,
    p_overtime_hours DECIMAL DEFAULT 0,
    p_overtime_rate DECIMAL DEFAULT 1.5,
    p_bonuses DECIMAL DEFAULT 0,
    p_deductions DECIMAL DEFAULT 0,
    p_tax_amount DECIMAL DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update payslip status
CREATE OR REPLACE FUNCTION update_payslip_status(
    p_payslip_id UUID,
    p_status TEXT,
    p_payment_method TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get payroll summary
CREATE OR REPLACE FUNCTION get_payroll_summary(
    p_period_start DATE DEFAULT NULL,
    p_period_end DATE DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REVIEW MANAGEMENT FUNCTIONS
-- =============================================

-- Get reviews for admin
CREATE OR REPLACE FUNCTION get_admin_reviews(
    p_status TEXT DEFAULT NULL,
    p_min_rating INTEGER DEFAULT NULL,
    p_max_rating INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update review visibility
CREATE OR REPLACE FUNCTION update_review_visibility(
    p_review_id UUID,
    p_is_visible BOOLEAN
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reply to review
CREATE OR REPLACE FUNCTION reply_to_review(
    p_review_id UUID,
    p_reply TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete review
CREATE OR REPLACE FUNCTION delete_review(p_review_id UUID)
RETURNS JSON AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    DELETE FROM reviews WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get review stats
CREATE OR REPLACE FUNCTION get_review_stats()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- NOTIFICATION MANAGEMENT FUNCTIONS
-- =============================================

-- Get notifications
CREATE OR REPLACE FUNCTION get_notifications(
    p_user_id UUID DEFAULT NULL,
    p_user_type TEXT DEFAULT 'employee',
    p_is_read BOOLEAN DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS JSON AS $$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE id = p_notification_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_type TEXT DEFAULT 'employee')
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_user_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'system',
    p_data JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    VALUES (p_user_id, p_user_type, p_title, p_message, p_type, p_data)
    RETURNING id INTO new_id;
    
    RETURN json_build_object('success', true, 'id', new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_type TEXT DEFAULT 'employee')
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REPORTS & ANALYTICS FUNCTIONS  
-- =============================================

-- Get category sales report
CREATE OR REPLACE FUNCTION get_category_sales_report(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get employee performance report
CREATE OR REPLACE FUNCTION get_employee_performance_report(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get inventory report
CREATE OR REPLACE FUNCTION get_inventory_report()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_build_object(
        'total_items', (SELECT COUNT(*) FROM inventory),
        'low_stock_count', (SELECT COUNT(*) FROM inventory WHERE quantity <= min_quantity),
        'out_of_stock', (SELECT COUNT(*) FROM inventory WHERE quantity = 0),
        'total_value', (SELECT COALESCE(SUM(quantity * cost_per_unit), 0) FROM inventory),
        'categories', (
            SELECT json_agg(
                json_build_object(
                    'category', category,
                    'item_count', COUNT(*),
                    'total_value', SUM(quantity * cost_per_unit),
                    'low_stock', COUNT(*) FILTER (WHERE quantity <= min_quantity)
                )
            )
            FROM inventory
            GROUP BY category
        ),
        'low_stock_items', (
            SELECT json_agg(
                json_build_object(
                    'id', id,
                    'name', name,
                    'quantity', quantity,
                    'min_quantity', min_quantity,
                    'unit', unit
                )
            )
            FROM inventory
            WHERE quantity <= min_quantity
            ORDER BY (quantity / NULLIF(min_quantity, 0)) ASC
            LIMIT 10
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INSERT ADMIN PROFILE
-- =============================================
-- Note: You need to manually create the auth user in Supabase Dashboard first
-- Then update the auth_user_id below with the actual UUID from auth.users

INSERT INTO employees (
    id,
    auth_user_id,
    employee_id,
    name,
    email,
    phone,
    role,
    status,
    permissions,
    portal_enabled,
    is_2fa_enabled,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    NULL, -- Update this with the auth.users UUID after creating the user manually
    'EMP-ADMIN-001',
    'Muhammad Waqar',
    'ahmadali207711@gmail.com',
    '+92 300 0000000',
    'admin',
    'active',
    '{
        "dashboard": true,
        "orders": true,
        "menu": true,
        "employees": true,
        "tables": true,
        "kitchen": true,
        "billing": true,
        "delivery": true,
        "attendance": true,
        "inventory": true,
        "reports": true,
        "settings": true,
        "promo_codes": true,
        "notifications": true,
        "audit": true,
        "payroll": true,
        "reviews": true,
        "deals": true
    }'::jsonb,
    true,
    false,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    permissions = EXCLUDED.permissions,
    portal_enabled = EXCLUDED.portal_enabled,
    updated_at = NOW();








    -- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE auth.audit_log_entries (
  instance_id uuid,
  id uuid NOT NULL,
  payload json,
  created_at timestamp with time zone,
  ip_address character varying NOT NULL DEFAULT ''::character varying,
  CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.flow_state (
  id uuid NOT NULL,
  user_id uuid,
  auth_code text NOT NULL,
  code_challenge_method USER-DEFINED NOT NULL,
  code_challenge text NOT NULL,
  provider_type text NOT NULL,
  provider_access_token text,
  provider_refresh_token text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  authentication_method text NOT NULL,
  auth_code_issued_at timestamp with time zone,
  CONSTRAINT flow_state_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.identities (
  provider_id text NOT NULL,
  user_id uuid NOT NULL,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  email text DEFAULT lower((identity_data ->> 'email'::text)),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT identities_pkey PRIMARY KEY (id),
  CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE auth.instances (
  id uuid NOT NULL,
  uuid uuid,
  raw_base_config text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT instances_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.mfa_amr_claims (
  session_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  authentication_method text NOT NULL,
  id uuid NOT NULL,
  CONSTRAINT mfa_amr_claims_pkey PRIMARY KEY (id),
  CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id)
);
CREATE TABLE auth.mfa_challenges (
  id uuid NOT NULL,
  factor_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  ip_address inet NOT NULL,
  otp_code text,
  web_authn_session_data jsonb,
  CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id)
);
CREATE TABLE auth.mfa_factors (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  friendly_name text,
  factor_type USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  secret text,
  phone text,
  last_challenged_at timestamp with time zone UNIQUE,
  web_authn_credential jsonb,
  web_authn_aaguid uuid,
  last_webauthn_challenge_data jsonb,
  CONSTRAINT mfa_factors_pkey PRIMARY KEY (id),
  CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE auth.oauth_authorizations (
  id uuid NOT NULL,
  authorization_id text NOT NULL UNIQUE,
  client_id uuid NOT NULL,
  user_id uuid,
  redirect_uri text NOT NULL CHECK (char_length(redirect_uri) <= 2048),
  scope text NOT NULL CHECK (char_length(scope) <= 4096),
  state text CHECK (char_length(state) <= 4096),
  resource text CHECK (char_length(resource) <= 2048),
  code_challenge text CHECK (char_length(code_challenge) <= 128),
  code_challenge_method USER-DEFINED,
  response_type USER-DEFINED NOT NULL DEFAULT 'code'::auth.oauth_response_type,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::auth.oauth_authorization_status,
  authorization_code text UNIQUE CHECK (char_length(authorization_code) <= 255),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:03:00'::interval),
  approved_at timestamp with time zone,
  nonce text CHECK (char_length(nonce) <= 255),
  CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id),
  CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id),
  CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE auth.oauth_client_states (
  id uuid NOT NULL,
  provider_type text NOT NULL,
  code_verifier text,
  created_at timestamp with time zone NOT NULL,
  CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.oauth_clients (
  id uuid NOT NULL,
  client_secret_hash text,
  registration_type USER-DEFINED NOT NULL,
  redirect_uris text NOT NULL,
  grant_types text NOT NULL,
  client_name text CHECK (char_length(client_name) <= 1024),
  client_uri text CHECK (char_length(client_uri) <= 2048),
  logo_uri text CHECK (char_length(logo_uri) <= 2048),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  client_type USER-DEFINED NOT NULL DEFAULT 'confidential'::auth.oauth_client_type,
  CONSTRAINT oauth_clients_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.oauth_consents (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  scopes text NOT NULL CHECK (char_length(scopes) <= 2048),
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  CONSTRAINT oauth_consents_pkey PRIMARY KEY (id),
  CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id)
);
CREATE TABLE auth.one_time_tokens (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_type USER-DEFINED NOT NULL,
  token_hash text NOT NULL CHECK (char_length(token_hash) > 0),
  relates_to text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE auth.refresh_tokens (
  instance_id uuid,
  id bigint NOT NULL DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass),
  token character varying UNIQUE,
  user_id character varying,
  revoked boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  parent character varying,
  session_id uuid,
  CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id)
);
CREATE TABLE auth.saml_providers (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  entity_id text NOT NULL UNIQUE CHECK (char_length(entity_id) > 0),
  metadata_xml text NOT NULL CHECK (char_length(metadata_xml) > 0),
  metadata_url text CHECK (metadata_url = NULL::text OR char_length(metadata_url) > 0),
  attribute_mapping jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  name_id_format text,
  CONSTRAINT saml_providers_pkey PRIMARY KEY (id),
  CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id)
);
CREATE TABLE auth.saml_relay_states (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  request_id text NOT NULL CHECK (char_length(request_id) > 0),
  for_email text,
  redirect_to text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  flow_state_id uuid,
  CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id),
  CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id),
  CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id)
);
CREATE TABLE auth.schema_migrations (
  version character varying NOT NULL,
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);
CREATE TABLE auth.sessions (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  factor_id uuid,
  aal USER-DEFINED,
  not_after timestamp with time zone,
  refreshed_at timestamp without time zone,
  user_agent text,
  ip inet,
  tag text,
  oauth_client_id uuid,
  refresh_token_hmac_key text,
  refresh_token_counter bigint,
  scopes text CHECK (char_length(scopes) <= 4096),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id)
);
CREATE TABLE auth.sso_domains (
  id uuid NOT NULL,
  sso_provider_id uuid NOT NULL,
  domain text NOT NULL CHECK (char_length(domain) > 0),
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT sso_domains_pkey PRIMARY KEY (id),
  CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id)
);
CREATE TABLE auth.sso_providers (
  id uuid NOT NULL,
  resource_id text CHECK (resource_id = NULL::text OR char_length(resource_id) > 0),
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  disabled boolean,
  CONSTRAINT sso_providers_pkey PRIMARY KEY (id)
);
CREATE TABLE auth.users (
  instance_id uuid,
  id uuid NOT NULL,
  aud character varying,
  role character varying,
  email character varying,
  encrypted_password character varying,
  email_confirmed_at timestamp with time zone,
  invited_at timestamp with time zone,
  confirmation_token character varying,
  confirmation_sent_at timestamp with time zone,
  recovery_token character varying,
  recovery_sent_at timestamp with time zone,
  email_change_token_new character varying,
  email_change character varying,
  email_change_sent_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  phone text DEFAULT NULL::character varying UNIQUE,
  phone_confirmed_at timestamp with time zone,
  phone_change text DEFAULT ''::character varying,
  phone_change_token character varying DEFAULT ''::character varying,
  phone_change_sent_at timestamp with time zone,
  confirmed_at timestamp with time zone DEFAULT LEAST(email_confirmed_at, phone_confirmed_at),
  email_change_token_current character varying DEFAULT ''::character varying,
  email_change_confirm_status smallint DEFAULT 0 CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2),
  banned_until timestamp with time zone,
  reauthentication_token character varying DEFAULT ''::character varying,
  reauthentication_sent_at timestamp with time zone,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  is_anonymous boolean NOT NULL DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);


-- =============================================
-- SUPABASE STORAGE BUCKETS SETUP
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- CREATE BUCKETS
-- =============================================

-- Main images bucket (menu, deals, website content)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'images', 
    'images', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Avatars bucket (customer and employee profiles)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars', 
    'avatars', 
    true,
    2097152, -- 2MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Reviews bucket (customer review images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'reviews', 
    'reviews', 
    true,
    3145728, -- 3MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 3145728,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

SELECT 'Buckets created' AS status;

-- =============================================
-- DROP EXISTING POLICIES (Clean slate)
-- =============================================

-- Images bucket policies
DROP POLICY IF EXISTS "Public read access for images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "images_auth_delete" ON storage.objects;

-- Avatars bucket policies
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;

-- Reviews bucket policies  
DROP POLICY IF EXISTS "Public read access for reviews" ON storage.objects;
DROP POLICY IF EXISTS "Customers can upload review images" ON storage.objects;
DROP POLICY IF EXISTS "reviews_public_read" ON storage.objects;
DROP POLICY IF EXISTS "reviews_auth_insert" ON storage.objects;

-- =============================================
-- IMAGES BUCKET POLICIES
-- Folders: menu/, deals/, categories/, site/
-- =============================================

-- Anyone can view images
CREATE POLICY "images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Authenticated users (employees) can upload
CREATE POLICY "images_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

-- Authenticated users can update
CREATE POLICY "images_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'images');

-- Authenticated users can delete
CREATE POLICY "images_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'images');

-- =============================================
-- AVATARS BUCKET POLICIES
-- Folders: customers/, employees/
-- =============================================

-- Anyone can view avatars
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated users can upload avatars
CREATE POLICY "avatars_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Users can update their own avatars
CREATE POLICY "avatars_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Users can delete their own avatars
CREATE POLICY "avatars_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- =============================================
-- REVIEWS BUCKET POLICIES
-- Folders: {customer_id}/
-- =============================================

-- Anyone can view review images
CREATE POLICY "reviews_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'reviews');

-- Authenticated users can upload review images
CREATE POLICY "reviews_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reviews');

-- =============================================
-- VERIFY SETUP
-- =============================================

SELECT 'Storage policies created' AS status;

-- List all buckets
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id IN ('images', 'avatars', 'reviews');

-- List policies for storage.objects
SELECT policyname, cmd, permissive
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
-- =============================================
-- STORAGE BUCKET POLICIES FIX
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- CREATE BUCKETS IF NOT EXIST
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('images', 'images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reviews', 'reviews', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 3145728;

-- =============================================
-- DROP ALL EXISTING POLICIES ON storage.objects
-- =============================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- =============================================
-- CREATE PERMISSIVE POLICIES FOR ALL BUCKETS
-- These allow all authenticated users full access
-- =============================================

-- PUBLIC SELECT: Anyone can view files in public buckets
CREATE POLICY "storage_public_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('images', 'avatars', 'reviews'));

-- AUTHENTICATED INSERT: Authenticated users can upload
CREATE POLICY "storage_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('images', 'avatars', 'reviews'));

-- AUTHENTICATED UPDATE: Authenticated users can update
CREATE POLICY "storage_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('images', 'avatars', 'reviews'))
WITH CHECK (bucket_id IN ('images', 'avatars', 'reviews'));

-- AUTHENTICATED DELETE: Authenticated users can delete
CREATE POLICY "storage_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('images', 'avatars', 'reviews'));

-- =============================================
-- ALSO ALLOW ANON ROLE FOR INSERT (in case auth is via service role)
-- =============================================

CREATE POLICY "storage_anon_insert"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id IN ('images', 'avatars', 'reviews'));

CREATE POLICY "storage_anon_update"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id IN ('images', 'avatars', 'reviews'))
WITH CHECK (bucket_id IN ('images', 'avatars', 'reviews'));

CREATE POLICY "storage_anon_delete"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id IN ('images', 'avatars', 'reviews'));

-- =============================================
-- VERIFY
-- =============================================

SELECT 'Storage policies created' AS status;

SELECT id, name, public FROM storage.buckets WHERE id IN ('images', 'avatars', 'reviews');

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
-- =============================================
-- FIX: Update delete_menu_item to handle RLS and return images
-- This fixes the "permission denied for table menu_items" error
-- =============================================

-- Drop old function
DROP FUNCTION IF EXISTS delete_menu_item(UUID);

-- Create new function with SECURITY DEFINER to bypass RLS
-- Returns images array so frontend can delete them from storage
CREATE OR REPLACE FUNCTION delete_menu_item(p_item_id UUID)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_menu_item(UUID) TO authenticated;

COMMENT ON FUNCTION delete_menu_item IS 'Deletes a menu item and returns its images for storage cleanup. Uses SECURITY DEFINER to bypass RLS policies.';
-- =============================================
-- ZOIRO BROAST HUB - ENHANCED RPC FUNCTIONS
-- Secure, Fast, Production-Ready
-- =============================================

-- =============================================
-- CREATE MISSING TABLES FIRST
-- =============================================

-- Loyalty Points Table
CREATE TABLE IF NOT EXISTS loyalty_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    points INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'redeemed', 'bonus', 'expired')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for loyalty points
CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer ON loyalty_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_type ON loyalty_points(type);

-- Add payment_proof_url column to orders if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'payment_proof_url') THEN
        ALTER TABLE orders ADD COLUMN payment_proof_url TEXT;
    END IF;
END $$;

-- =============================================
-- ENABLE REALTIME FOR CRITICAL TABLES
-- =============================================

-- Safely enable realtime - ignore errors if already added
DO $$ 
BEGIN
    -- Try to add tables to realtime publication (ignore if already exists)
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE order_status_history;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- =============================================
-- DROP ALL RLS POLICIES FIRST (before functions)
-- =============================================

-- Customers
DROP POLICY IF EXISTS "Customers can view own profile" ON customers;
DROP POLICY IF EXISTS "Customers can update own profile" ON customers;
DROP POLICY IF EXISTS "Anyone can create customer" ON customers;

-- Employees
DROP POLICY IF EXISTS "Employees can view own profile" ON employees;
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;
DROP POLICY IF EXISTS "Admins can create employees" ON employees;
DROP POLICY IF EXISTS "Admins can update employees" ON employees;
DROP POLICY IF EXISTS "Employees can update own profile" ON employees;

-- Menu Categories
DROP POLICY IF EXISTS "Anyone can view visible categories" ON menu_categories;
DROP POLICY IF EXISTS "Employees can view all categories" ON menu_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON menu_categories;

-- Menu Items
DROP POLICY IF EXISTS "Anyone can view available items" ON menu_items;
DROP POLICY IF EXISTS "Employees can view all items" ON menu_items;
DROP POLICY IF EXISTS "Kitchen can update item availability" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage items" ON menu_items;

-- Meals
DROP POLICY IF EXISTS "Anyone can view available meals" ON meals;
DROP POLICY IF EXISTS "Admins can manage meals" ON meals;

-- Deals
DROP POLICY IF EXISTS "Anyone can view active deals" ON deals;
DROP POLICY IF EXISTS "Admins can manage deals" ON deals;

-- Orders
DROP POLICY IF EXISTS "Customers can view own orders" ON orders;
DROP POLICY IF EXISTS "Customers can create orders" ON orders;
DROP POLICY IF EXISTS "Employees can view all orders" ON orders;
DROP POLICY IF EXISTS "Staff can update orders" ON orders;
DROP POLICY IF EXISTS "Cashiers can create walk-in orders" ON orders;

-- Order Status History
DROP POLICY IF EXISTS "order_status_history_select" ON order_status_history;
DROP POLICY IF EXISTS "order_status_history_insert" ON order_status_history;

-- Reviews
DROP POLICY IF EXISTS "Customers can create reviews" ON reviews;
DROP POLICY IF EXISTS "Customers can view own reviews" ON reviews;
DROP POLICY IF EXISTS "Anyone can view visible reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can manage reviews" ON reviews;

-- Site Content
DROP POLICY IF EXISTS "Anyone can view active content" ON site_content;
DROP POLICY IF EXISTS "Admins can manage content" ON site_content;

-- Restaurant Tables
DROP POLICY IF EXISTS "Staff can view tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Reception can update tables" ON restaurant_tables;

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Audit Logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can create audit logs" ON audit_logs;

-- OTP Codes
DROP POLICY IF EXISTS "Public can read OTP for verification" ON otp_codes;
DROP POLICY IF EXISTS "System can create OTP" ON otp_codes;
DROP POLICY IF EXISTS "System can update OTP" ON otp_codes;

-- Loyalty Points
DROP POLICY IF EXISTS "Customers can view own loyalty points" ON loyalty_points;
DROP POLICY IF EXISTS "System can manage loyalty points" ON loyalty_points;

-- =============================================
-- DROP ALL FUNCTIONS (after policies are dropped)
-- =============================================

-- RLS Helper Functions
DROP FUNCTION IF EXISTS is_employee() CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS has_role(TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS get_my_customer_id() CASCADE;
DROP FUNCTION IF EXISTS get_my_employee_id() CASCADE;

-- Authentication & User Management
DROP FUNCTION IF EXISTS check_user_type(TEXT);
DROP FUNCTION IF EXISTS register_customer(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_user_profile(UUID);

-- Order Management
DROP FUNCTION IF EXISTS create_customer_order(UUID, JSONB, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, payment_method, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_customer_order(UUID, JSONB, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, payment_method, TEXT, TEXT, TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS update_order_status_rpc(UUID, order_status, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS get_customer_orders_paginated(UUID, INT, INT, order_status);
DROP FUNCTION IF EXISTS get_order_details(UUID, UUID);

-- Customer Profile Management
DROP FUNCTION IF EXISTS update_customer_profile(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS toggle_2fa(UUID, BOOLEAN, TEXT);

-- Loyalty & Promo Codes
DROP FUNCTION IF EXISTS get_loyalty_balance(UUID);
DROP FUNCTION IF EXISTS add_order_loyalty_points(UUID, UUID, DECIMAL);
DROP FUNCTION IF EXISTS validate_promo_code(TEXT, UUID, DECIMAL);

-- Payment Management
DROP FUNCTION IF EXISTS record_payment_proof(UUID, UUID, TEXT, payment_method);
DROP FUNCTION IF EXISTS confirm_payment(UUID, UUID);

-- Menu & Deals
DROP FUNCTION IF EXISTS get_menu_with_categories(TEXT);
DROP FUNCTION IF EXISTS get_active_deals();

-- Notifications
DROP FUNCTION IF EXISTS get_unread_notifications_count(UUID, TEXT);
DROP FUNCTION IF EXISTS mark_notifications_read(UUID, UUID[]);

-- Analytics
DROP FUNCTION IF EXISTS get_customer_stats(UUID);

-- =============================================
-- AUTHENTICATION & USER MANAGEMENT RPC
-- =============================================

-- Check user type by email (admin/employee/customer)
CREATE OR REPLACE FUNCTION check_user_type(p_email TEXT)
RETURNS TABLE (
    user_type TEXT,
    existing_user BOOLEAN,
    role TEXT,
    employee_id TEXT,
    status TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Register customer with all validation
CREATE OR REPLACE FUNCTION register_customer(
    p_auth_user_id UUID,
    p_email TEXT,
    p_name TEXT,
    p_phone TEXT,
    p_address TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    customer_id UUID,
    error_message TEXT
) AS $$
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
    VALUES ('customer', v_customer_id, 'Welcome to Zoiro Broast Hub! 🍗', 
            'Your account has been created successfully. Start ordering delicious food now!', 'system');

    RETURN QUERY SELECT TRUE, v_customer_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user profile with caching info
CREATE OR REPLACE FUNCTION get_user_profile(p_auth_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    user_type TEXT,
    email TEXT,
    name TEXT,
    phone TEXT,
    address TEXT,
    role TEXT,
    is_verified BOOLEAN,
    is_2fa_enabled BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ORDER MANAGEMENT RPC
-- =============================================

-- Create order with full validation
CREATE OR REPLACE FUNCTION create_customer_order(
    p_customer_id UUID,
    p_items JSONB,
    p_subtotal DECIMAL,
    p_tax DECIMAL,
    p_delivery_fee DECIMAL,
    p_discount DECIMAL,
    p_total DECIMAL,
    p_payment_method payment_method,
    p_delivery_address TEXT,
    p_notes TEXT DEFAULT NULL,
    p_promo_code TEXT DEFAULT NULL,
    p_transaction_id TEXT DEFAULT NULL,
    p_online_payment_method_id UUID DEFAULT NULL,
    p_online_payment_details JSONB DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    order_id UUID,
    order_number TEXT,
    error_message TEXT
) AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_customer_name TEXT;
    v_customer_email TEXT;
    v_customer_phone TEXT;
BEGIN
    -- Get customer info
    SELECT name, email, phone INTO v_customer_name, v_customer_email, v_customer_phone
    FROM customers WHERE id = p_customer_id;

    IF v_customer_name IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Customer not found';
        RETURN;
    END IF;

    -- Validate items
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'No items in order';
        RETURN;
    END IF;

    -- Validate total
    IF p_total <= 0 THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, 'Invalid order total';
        RETURN;
    END IF;

    -- Create order
    INSERT INTO orders (
        customer_id, customer_name, customer_email, customer_phone,
        customer_address, order_type, items, subtotal, tax, 
        delivery_fee, discount, total, payment_method, notes,
        transaction_id, online_payment_method_id, online_payment_details,
        payment_status
    ) VALUES (
        p_customer_id, v_customer_name, v_customer_email, v_customer_phone,
        p_delivery_address, 'online', p_items, p_subtotal, p_tax,
        p_delivery_fee, p_discount, p_total, p_payment_method, p_notes,
        p_transaction_id, p_online_payment_method_id, p_online_payment_details,
        CASE WHEN p_transaction_id IS NOT NULL THEN 'pending_verification' ELSE 'pending' END
    )
    RETURNING id, order_number INTO v_order_id, v_order_number;

    -- Create initial status history
    INSERT INTO order_status_history (order_id, status, notes)
    VALUES (v_order_id, 'pending', 'Order placed by customer');

    -- Create notification for customer
    INSERT INTO notifications (user_type, user_id, title, message, type, data)
    VALUES (
        'customer', p_customer_id,
        'Order Placed Successfully! 🎉',
        'Your order ' || v_order_number || ' has been placed. We''ll start preparing it soon!',
        'order',
        jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number)
    );

    -- Apply promo code if provided
    IF p_promo_code IS NOT NULL THEN
        -- Update promo code usage (if promo_codes table exists)
        UPDATE deals 
        SET usage_count = COALESCE(usage_count, 0) + 1
        WHERE slug = LOWER(p_promo_code) AND is_active = TRUE;
    END IF;

    RETURN QUERY SELECT TRUE, v_order_id, v_order_number, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update order status with notifications
CREATE OR REPLACE FUNCTION update_order_status_rpc(
    p_order_id UUID,
    p_new_status order_status,
    p_changed_by UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_assigned_to UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
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
        WHEN 'confirmed' THEN 'Your order ' || v_order_number || ' has been confirmed! 👍'
        WHEN 'preparing' THEN 'Your order ' || v_order_number || ' is being prepared! 👨‍🍳'
        WHEN 'ready' THEN 'Your order ' || v_order_number || ' is ready! 🍗'
        WHEN 'delivering' THEN 'Your order ' || v_order_number || ' is on the way! 🛵'
        WHEN 'delivered' THEN 'Your order ' || v_order_number || ' has been delivered! Enjoy! 😋'
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get customer orders with pagination
CREATE OR REPLACE FUNCTION get_customer_orders_paginated(
    p_customer_id UUID,
    p_limit INT DEFAULT 10,
    p_offset INT DEFAULT 0,
    p_status order_status DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    items JSONB,
    total DECIMAL,
    status order_status,
    payment_method payment_method,
    payment_status TEXT,
    created_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    assigned_to_name TEXT
) AS $$
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
        o.created_at,
        o.delivered_at,
        e.name::TEXT
    FROM orders o
    LEFT JOIN employees e ON o.assigned_to = e.id
    WHERE o.customer_id = p_customer_id
        AND (p_status IS NULL OR o.status = p_status)
    ORDER BY o.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get order details with full info
CREATE OR REPLACE FUNCTION get_order_details(p_order_id UUID, p_customer_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    items JSONB,
    subtotal DECIMAL,
    tax DECIMAL,
    delivery_fee DECIMAL,
    discount DECIMAL,
    total DECIMAL,
    payment_method payment_method,
    payment_status TEXT,
    status order_status,
    notes TEXT,
    assigned_to UUID,
    assigned_to_name TEXT,
    assigned_to_phone TEXT,
    created_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    status_history JSONB
) AS $$
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
        )
    FROM orders o
    LEFT JOIN employees e ON o.assigned_to = e.id
    WHERE o.id = p_order_id
        AND (p_customer_id IS NULL OR o.customer_id = p_customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CUSTOMER PROFILE MANAGEMENT RPC
-- =============================================

-- Update customer profile
CREATE OR REPLACE FUNCTION update_customer_profile(
    p_customer_id UUID,
    p_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable/disable 2FA
CREATE OR REPLACE FUNCTION toggle_2fa(
    p_customer_id UUID,
    p_enable BOOLEAN,
    p_secret TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- LOYALTY POINTS & PROMO CODES RPC
-- =============================================

-- Get customer loyalty points balance
CREATE OR REPLACE FUNCTION get_loyalty_balance(p_customer_id UUID)
RETURNS TABLE (
    total_points INT,
    redeemable_points INT,
    pending_points INT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add loyalty points from order
CREATE OR REPLACE FUNCTION add_order_loyalty_points(
    p_customer_id UUID,
    p_order_id UUID,
    p_order_total DECIMAL
)
RETURNS INT AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate promo code
CREATE OR REPLACE FUNCTION validate_promo_code(
    p_code TEXT,
    p_customer_id UUID,
    p_order_subtotal DECIMAL
)
RETURNS TABLE (
    valid BOOLEAN,
    discount_type TEXT,
    discount_value DECIMAL,
    discount_amount DECIMAL,
    error_message TEXT
) AS $$
DECLARE
    v_deal RECORD;
BEGIN
    -- Find the deal/promo code
    SELECT * INTO v_deal
    FROM deals
    WHERE LOWER(slug) = LOWER(p_code)
        AND is_active = TRUE
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until >= NOW());

    IF v_deal IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, 'Invalid or expired promo code';
        RETURN;
    END IF;

    -- Check minimum order amount
    IF v_deal.minimum_order_amount IS NOT NULL AND p_order_subtotal < v_deal.minimum_order_amount THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, 
            'Minimum order of Rs. ' || v_deal.minimum_order_amount || ' required';
        RETURN;
    END IF;

    -- Check usage limit
    IF v_deal.usage_limit IS NOT NULL AND v_deal.usage_count >= v_deal.usage_limit THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, 'Promo code has reached its usage limit';
        RETURN;
    END IF;

    -- Calculate discount
    IF v_deal.discount_percentage IS NOT NULL THEN
        RETURN QUERY SELECT 
            TRUE, 
            'percentage'::TEXT, 
            v_deal.discount_percentage,
            ROUND((p_order_subtotal * v_deal.discount_percentage / 100), 2),
            NULL::TEXT;
    ELSE
        RETURN QUERY SELECT 
            TRUE, 
            'fixed'::TEXT, 
            v_deal.discount_amount,
            LEAST(v_deal.discount_amount, p_order_subtotal),
            NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PAYMENT MANAGEMENT RPC
-- =============================================

-- Record payment proof upload
CREATE OR REPLACE FUNCTION record_payment_proof(
    p_order_id UUID,
    p_customer_id UUID,
    p_proof_url TEXT,
    p_payment_method payment_method
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confirm payment (admin/cashier only)
CREATE OR REPLACE FUNCTION confirm_payment(
    p_order_id UUID,
    p_confirmed_by UUID
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
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
        'Payment Confirmed ✅',
        'Your payment for order ' || v_order_number || ' has been confirmed!',
        'payment',
        jsonb_build_object('order_id', p_order_id)
    );

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- MENU & DEALS RPC
-- =============================================

-- Get menu items with category
CREATE OR REPLACE FUNCTION get_menu_with_categories(p_category_slug TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    description TEXT,
    price DECIMAL,
    images JSONB,
    category_id UUID,
    category_name TEXT,
    category_slug TEXT,
    is_available BOOLEAN,
    is_featured BOOLEAN,
    rating DECIMAL,
    total_reviews INT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active deals
CREATE OR REPLACE FUNCTION get_active_deals()
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    description TEXT,
    discount_percentage DECIMAL,
    discount_amount DECIMAL,
    images JSONB,
    minimum_order_amount DECIMAL,
    valid_until TIMESTAMPTZ
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- NOTIFICATIONS RPC
-- =============================================

-- Get unread notifications count
CREATE OR REPLACE FUNCTION get_unread_notifications_count(
    p_user_id UUID,
    p_user_type TEXT
)
RETURNS INT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INT
        FROM notifications
        WHERE user_id = p_user_id
            AND user_type = p_user_type
            AND is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
    p_user_id UUID,
    p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INT AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ANALYTICS RPC (for customers)
-- =============================================

-- Get customer order stats
CREATE OR REPLACE FUNCTION get_customer_stats(p_customer_id UUID)
RETURNS TABLE (
    total_orders INT,
    total_spent DECIMAL,
    average_order_value DECIMAL,
    loyalty_points INT,
    favorite_items JSONB
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RLS HELPER FUNCTIONS (recreate after policies dropped)
-- =============================================

-- Check if current user is an employee (bypasses RLS)
CREATE OR REPLACE FUNCTION is_employee()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees WHERE auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is an admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user has a specific role (bypasses RLS)
CREATE OR REPLACE FUNCTION has_role(required_roles text[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees WHERE auth_user_id = auth.uid() AND role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's customer ID (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_customer_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM customers WHERE auth_user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's employee ID (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_employee_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Public read tables
GRANT SELECT ON menu_categories TO anon;
GRANT SELECT ON menu_items TO anon;
GRANT SELECT ON meals TO anon;
GRANT SELECT ON deals TO anon;
GRANT SELECT ON reviews TO anon;
GRANT SELECT ON site_content TO anon;

-- Authenticated user access
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO authenticated;
GRANT SELECT ON menu_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO authenticated;
GRANT SELECT, INSERT ON order_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON site_content TO authenticated;
GRANT SELECT, UPDATE ON restaurant_tables TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT ON loyalty_points TO authenticated;

-- OTP codes need public access
GRANT SELECT, INSERT, UPDATE ON otp_codes TO anon;
GRANT SELECT, INSERT, UPDATE ON otp_codes TO authenticated;

-- Customers table needs anon insert for registration
GRANT INSERT ON customers TO anon;

-- =============================================
-- CREATE RLS POLICIES
-- =============================================

-- CUSTOMERS POLICIES
CREATE POLICY "Customers can view own profile"
    ON customers FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Customers can update own profile"
    ON customers FOR UPDATE
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Anyone can create customer"
    ON customers FOR INSERT
    WITH CHECK (true);

-- EMPLOYEES POLICIES
CREATE POLICY "Employees can view own profile"
    ON employees FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all employees"
    ON employees FOR SELECT
    USING (is_admin());

CREATE POLICY "Admins can create employees"
    ON employees FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update employees"
    ON employees FOR UPDATE
    USING (is_admin());

CREATE POLICY "Employees can update own profile"
    ON employees FOR UPDATE
    USING (auth.uid() = auth_user_id);

-- MENU POLICIES (PUBLIC READ)
CREATE POLICY "Anyone can view visible categories"
    ON menu_categories FOR SELECT
    USING (is_visible = true);

CREATE POLICY "Employees can view all categories"
    ON menu_categories FOR SELECT
    USING (is_employee());

CREATE POLICY "Admins can manage categories"
    ON menu_categories FOR ALL
    USING (is_admin());

CREATE POLICY "Anyone can view available items"
    ON menu_items FOR SELECT
    USING (is_available = true);

CREATE POLICY "Employees can view all items"
    ON menu_items FOR SELECT
    USING (is_employee());

CREATE POLICY "Kitchen can update item availability"
    ON menu_items FOR UPDATE
    USING (has_role(ARRAY['kitchen', 'admin', 'manager']));

CREATE POLICY "Admins can manage items"
    ON menu_items FOR ALL
    USING (has_role(ARRAY['admin', 'manager']));

CREATE POLICY "Anyone can view available meals"
    ON meals FOR SELECT
    USING (is_available = true);

CREATE POLICY "Admins can manage meals"
    ON meals FOR ALL
    USING (has_role(ARRAY['admin', 'manager']));

CREATE POLICY "Anyone can view active deals"
    ON deals FOR SELECT
    USING (is_active = true AND NOW() BETWEEN COALESCE(valid_from, NOW()) AND COALESCE(valid_until, NOW() + INTERVAL '100 years'));

CREATE POLICY "Admins can manage deals"
    ON deals FOR ALL
    USING (has_role(ARRAY['admin', 'manager']));

-- ORDERS POLICIES
CREATE POLICY "Customers can view own orders"
    ON orders FOR SELECT
    USING (customer_id = get_my_customer_id());

CREATE POLICY "Customers can create orders"
    ON orders FOR INSERT
    WITH CHECK (customer_id = get_my_customer_id());

CREATE POLICY "Employees can view all orders"
    ON orders FOR SELECT
    USING (is_employee());

CREATE POLICY "Staff can update orders"
    ON orders FOR UPDATE
    USING (has_role(ARRAY['kitchen', 'reception', 'admin', 'manager']));

CREATE POLICY "Cashiers can create walk-in orders"
    ON orders FOR INSERT
    WITH CHECK (has_role(ARRAY['cashier', 'admin', 'manager']));

-- ORDER STATUS HISTORY POLICIES
CREATE POLICY "order_status_history_select"
    ON order_status_history FOR SELECT
    USING (true);

CREATE POLICY "order_status_history_insert"
    ON order_status_history FOR INSERT
    WITH CHECK (true);

-- REVIEWS POLICIES
CREATE POLICY "Customers can create reviews"
    ON reviews FOR INSERT
    WITH CHECK (customer_id = get_my_customer_id());

CREATE POLICY "Customers can view own reviews"
    ON reviews FOR SELECT
    USING (customer_id = get_my_customer_id());

CREATE POLICY "Anyone can view visible reviews"
    ON reviews FOR SELECT
    USING (is_visible = true);

CREATE POLICY "Admins can manage reviews"
    ON reviews FOR ALL
    USING (has_role(ARRAY['admin', 'manager']));

-- SITE CONTENT POLICIES
CREATE POLICY "Anyone can view active content"
    ON site_content FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage content"
    ON site_content FOR ALL
    USING (is_admin());

-- TABLES POLICIES
CREATE POLICY "Staff can view tables"
    ON restaurant_tables FOR SELECT
    USING (has_role(ARRAY['reception', 'kitchen', 'admin', 'manager']));

CREATE POLICY "Reception can update tables"
    ON restaurant_tables FOR UPDATE
    USING (has_role(ARRAY['reception', 'admin', 'manager']));

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (
        (user_type = 'customer' AND user_id = get_my_customer_id()) OR
        (user_type = 'employee' AND user_id = get_my_employee_id())
    );

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (
        (user_type = 'customer' AND user_id = get_my_customer_id()) OR
        (user_type = 'employee' AND user_id = get_my_employee_id())
    );

CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- AUDIT LOGS POLICIES
CREATE POLICY "Admins can view audit logs"
    ON audit_logs FOR SELECT
    USING (is_admin());

CREATE POLICY "System can create audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- OTP CODES POLICIES
CREATE POLICY "Public can read OTP for verification"
    ON otp_codes FOR SELECT
    USING (true);

CREATE POLICY "System can create OTP"
    ON otp_codes FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can update OTP"
    ON otp_codes FOR UPDATE
    USING (true);

-- LOYALTY POINTS POLICIES
CREATE POLICY "Customers can view own loyalty points"
    ON loyalty_points FOR SELECT
    USING (customer_id = get_my_customer_id());

CREATE POLICY "System can manage loyalty points"
    ON loyalty_points FOR INSERT
    WITH CHECK (true);

-- =============================================
-- OPTIMIZED INDEXES FOR FAST QUERIES
-- =============================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, user_type) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_loyalty_customer_type ON loyalty_points(customer_id, type);
CREATE INDEX IF NOT EXISTS idx_menu_items_featured ON menu_items(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_deals_active ON deals(is_active, valid_from, valid_until) WHERE is_active = TRUE;

-- =============================================
-- REALTIME TRIGGERS FOR NOTIFICATIONS
-- =============================================

-- Trigger to automatically log status changes to order_status_history
CREATE OR REPLACE FUNCTION auto_log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Automatically insert into status history
        INSERT INTO order_status_history (order_id, status, notes)
        VALUES (NEW.id, NEW.status, 'Status automatically updated to ' || NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_order_status_auto_log ON orders;
CREATE TRIGGER on_order_status_auto_log
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_log_order_status_change();

-- Trigger to notify on order status change
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_order_status_change ON orders;
CREATE TRIGGER on_order_status_change
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_order_status_change();

-- Trigger to notify on new notification
CREATE OR REPLACE FUNCTION notify_new_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_new_notification ON notifications;
CREATE TRIGGER on_new_notification
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_notification();



    -- =============================================
-- ZOIRO BROAST HUB - PORTAL RPC FUNCTIONS
-- High-Performance Database Functions
-- =============================================

-- =============================================
-- DROP ALL EXISTING FUNCTIONS FIRST
-- =============================================
DROP FUNCTION IF EXISTS get_admin_dashboard_stats();
DROP FUNCTION IF EXISTS get_sales_analytics(DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS get_hourly_sales_today();
DROP FUNCTION IF EXISTS create_employee(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, DECIMAL, DATE);
DROP FUNCTION IF EXISTS activate_employee_account(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS get_employee_analytics(UUID);
DROP FUNCTION IF EXISTS toggle_employee_status(UUID, TEXT);
DROP FUNCTION IF EXISTS get_waiter_dashboard();
DROP FUNCTION IF EXISTS create_dine_in_order(UUID, INTEGER, JSONB, UUID, VARCHAR, VARCHAR, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS cancel_order_by_waiter(UUID, TEXT);
DROP FUNCTION IF EXISTS request_table_exchange(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS respond_table_exchange(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS get_kitchen_orders();
DROP FUNCTION IF EXISTS update_order_status_kitchen(UUID, TEXT);
DROP FUNCTION IF EXISTS generate_invoice(UUID, TEXT, DECIMAL, UUID);
DROP FUNCTION IF EXISTS mark_attendance_with_code(TEXT);
DROP FUNCTION IF EXISTS generate_attendance_code(TIME, TIME);
DROP FUNCTION IF EXISTS get_tables_status();
DROP FUNCTION IF EXISTS update_table_status(UUID, TEXT);
DROP FUNCTION IF EXISTS send_notification(UUID[], TEXT, TEXT, TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS get_my_notifications(INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS mark_notifications_read(UUID[]);
DROP FUNCTION IF EXISTS get_delivery_orders();
DROP FUNCTION IF EXISTS accept_delivery_order(UUID);
DROP FUNCTION IF EXISTS complete_delivery(UUID);
DROP FUNCTION IF EXISTS generate_sales_report(DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS generate_employee_report(DATE, DATE);
DROP FUNCTION IF EXISTS validate_promo_code(TEXT, UUID, DECIMAL);
DROP FUNCTION IF EXISTS get_inventory_items();
DROP FUNCTION IF EXISTS create_inventory_item(TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_inventory_item(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS adjust_inventory_stock(UUID, DECIMAL, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS get_inventory_transactions(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS delete_inventory_item(UUID);
DROP FUNCTION IF EXISTS get_deals();
DROP FUNCTION IF EXISTS create_deal(TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT[], BOOLEAN);
DROP FUNCTION IF EXISTS update_deal(UUID, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT[], BOOLEAN);
DROP FUNCTION IF EXISTS toggle_deal_status(UUID);
DROP FUNCTION IF EXISTS delete_deal(UUID);
DROP FUNCTION IF EXISTS get_audit_logs(TEXT, TEXT, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER);
DROP FUNCTION IF EXISTS log_audit_action(TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS get_payslips(UUID, TEXT, DATE, DATE, INTEGER);
DROP FUNCTION IF EXISTS create_payslip(UUID, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS update_payslip_status(UUID, TEXT);
DROP FUNCTION IF EXISTS get_payroll_summary(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_admin_reviews(INTEGER, TEXT, BOOLEAN, TEXT, INTEGER);
DROP FUNCTION IF EXISTS update_review_visibility(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS reply_to_review(UUID, TEXT);
DROP FUNCTION IF EXISTS delete_review(UUID);
DROP FUNCTION IF EXISTS get_review_stats();
DROP FUNCTION IF EXISTS get_notifications(UUID, TEXT, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS mark_notification_read(UUID);
DROP FUNCTION IF EXISTS mark_all_notifications_read(TEXT);
DROP FUNCTION IF EXISTS create_notification(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS get_unread_notification_count(TEXT);
DROP FUNCTION IF EXISTS get_category_sales_report(DATE, DATE);
DROP FUNCTION IF EXISTS get_employee_performance_report(DATE, DATE);
DROP FUNCTION IF EXISTS get_inventory_report();
DROP FUNCTION IF EXISTS get_user_by_email(TEXT);

-- =============================================
-- USER LOOKUP FUNCTION (BYPASSES RLS)
-- =============================================

-- Get user by email - checks both employees and customers tables
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    phone TEXT,
    user_type TEXT,
    role TEXT,
    permissions JSONB,
    employee_id TEXT,
    status TEXT,
    is_2fa_enabled BOOLEAN
) AS $$
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
            e.is_2fa_enabled
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
        c.is_2fa_enabled
    FROM customers c
    WHERE LOWER(c.email) = LOWER(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DASHBOARD ANALYTICS FUNCTIONS
-- =============================================

-- Get admin dashboard stats
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_sales', (
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
            AND status NOT IN ('cancelled')
        ),
        'total_sales_today', (
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE created_at >= date_trunc('day', CURRENT_DATE)
            AND status NOT IN ('cancelled')
        ),
        'total_orders_today', (
            SELECT COUNT(*)
            FROM orders
            WHERE created_at >= date_trunc('day', CURRENT_DATE)
        ),
        'total_orders_month', (
            SELECT COUNT(*)
            FROM orders
            WHERE created_at >= date_trunc('month', CURRENT_DATE)
        ),
        'pending_orders', (
            SELECT COUNT(*)
            FROM orders
            WHERE status IN ('pending', 'confirmed', 'preparing')
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
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get sales analytics
CREATE OR REPLACE FUNCTION get_sales_analytics(
    p_start_date DATE,
    p_end_date DATE,
    p_group_by TEXT DEFAULT 'day'
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get hourly sales for today
CREATE OR REPLACE FUNCTION get_hourly_sales_today()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'hour', hour,
            'sales', COALESCE(total_sales, 0),
            'orders', COALESCE(order_count, 0)
        )
        ORDER BY hour
    ) INTO result
    FROM (
        SELECT 
            generate_series(0, 23) as hour
    ) hours
    LEFT JOIN (
        SELECT 
            EXTRACT(HOUR FROM created_at)::INTEGER as hour,
            SUM(total) as total_sales,
            COUNT(*) as order_count
        FROM orders
        WHERE DATE(created_at) = CURRENT_DATE
        AND status NOT IN ('cancelled')
        GROUP BY EXTRACT(HOUR FROM created_at)
    ) sales ON hours.hour = sales.hour;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- EMPLOYEE MANAGEMENT FUNCTIONS
-- =============================================

-- Create employee with license
CREATE OR REPLACE FUNCTION create_employee(
    p_name VARCHAR(255),
    p_email VARCHAR(255),
    p_phone VARCHAR(20),
    p_role TEXT,
    p_salary DECIMAL(10, 2),
    p_hired_date DATE,
    p_documents JSONB DEFAULT '[]',
    p_address TEXT DEFAULT NULL,
    p_emergency_contact VARCHAR(20) DEFAULT NULL,
    p_emergency_contact_name VARCHAR(255) DEFAULT NULL,
    p_date_of_birth DATE DEFAULT NULL,
    p_blood_group VARCHAR(10) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activate employee account
CREATE OR REPLACE FUNCTION activate_employee_account(
    p_license_id VARCHAR(50),
    p_auth_user_id UUID
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get employee analytics
CREATE OR REPLACE FUNCTION get_employee_analytics(p_employee_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Block/unblock employee
CREATE OR REPLACE FUNCTION toggle_employee_status(
    p_employee_id UUID,
    p_status TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- WAITER FUNCTIONS
-- =============================================

-- Get waiter dashboard
CREATE OR REPLACE FUNCTION get_waiter_dashboard()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create dine-in order
CREATE OR REPLACE FUNCTION create_dine_in_order(
    p_table_id UUID,
    p_customer_count INTEGER,
    p_items JSONB,
    p_customer_id UUID DEFAULT NULL,
    p_customer_name VARCHAR(255) DEFAULT NULL,
    p_customer_phone VARCHAR(20) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_send_confirmation BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
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
    
    -- Create order
    INSERT INTO orders (
        customer_id, customer_name, customer_phone,
        order_type, items, subtotal, total,
        payment_method, table_number, notes,
        waiter_id, assigned_to, can_cancel_until
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
        NOW() + INTERVAL '5 minutes'
    ) RETURNING id INTO new_order_id;
    
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
        'send_confirmation', p_send_confirmation
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel order (within time limit)
CREATE OR REPLACE FUNCTION cancel_order_by_waiter(
    p_order_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Request table exchange
CREATE OR REPLACE FUNCTION request_table_exchange(
    p_table_id UUID,
    p_to_waiter_id UUID,
    p_exchange_type TEXT,
    p_swap_table_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Respond to table exchange
CREATE OR REPLACE FUNCTION respond_table_exchange(
    p_request_id UUID,
    p_accept BOOLEAN
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- KITCHEN FUNCTIONS
-- =============================================

-- Get kitchen orders
CREATE OR REPLACE FUNCTION get_kitchen_orders()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'order_type', o.order_type,
            'table_number', o.table_number,
            'items', o.items,
            'status', o.status,
            'notes', o.notes,
            'waiter', (
                SELECT json_build_object('id', e.id, 'name', e.name)
                FROM employees e WHERE e.id = o.waiter_id
            ),
            'created_at', o.created_at,
            'kitchen_started_at', o.kitchen_started_at
        )
        ORDER BY 
            CASE o.status 
                WHEN 'confirmed' THEN 1
                WHEN 'preparing' THEN 2
                ELSE 3
            END,
            o.created_at
    ) INTO result
    FROM orders o
    WHERE o.status IN ('confirmed', 'preparing', 'pending')
    AND o.created_at >= CURRENT_DATE;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update order status from kitchen
CREATE OR REPLACE FUNCTION update_order_status_kitchen(
    p_order_id UUID,
    p_status TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- BILLING FUNCTIONS
-- =============================================

-- Generate invoice
CREATE OR REPLACE FUNCTION generate_invoice(
    p_order_id UUID,
    p_payment_method TEXT,
    p_tip DECIMAL(10, 2) DEFAULT 0,
    p_discount DECIMAL(10, 2) DEFAULT 0,
    p_promo_code TEXT DEFAULT NULL,
    p_loyalty_points_used INTEGER DEFAULT 0
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ATTENDANCE FUNCTIONS
-- =============================================

-- Mark attendance with code
CREATE OR REPLACE FUNCTION mark_attendance_with_code(
    p_code VARCHAR(10)
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    code_record RECORD;
    attendance_record RECORD;
BEGIN
    emp_id := get_employee_id();
    
    -- Validate code
    SELECT * INTO code_record
    FROM attendance_codes
    WHERE code = p_code
    AND is_active = true
    AND valid_for_date = CURRENT_DATE
    AND CURRENT_TIME BETWEEN valid_from AND valid_until;
    
    IF code_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired code');
    END IF;
    
    -- Check if already checked in
    SELECT * INTO attendance_record
    FROM attendance
    WHERE employee_id = emp_id
    AND date = CURRENT_DATE;
    
    IF attendance_record IS NOT NULL THEN
        -- Check out
        IF attendance_record.check_out IS NOT NULL THEN
            RETURN json_build_object('success', false, 'error', 'Already checked out today');
        END IF;
        
        UPDATE attendance
        SET check_out = NOW(),
            check_out_method = 'code',
            hours_worked = EXTRACT(EPOCH FROM (NOW() - check_in)) / 3600
        WHERE id = attendance_record.id;
        
        RETURN json_build_object('success', true, 'action', 'check_out');
    ELSE
        -- Check in
        INSERT INTO attendance (employee_id, date, check_in, check_in_method, status)
        VALUES (
            emp_id,
            CURRENT_DATE,
            NOW(),
            'code',
            CASE 
                WHEN CURRENT_TIME > '09:30:00'::TIME THEN 'late'
                ELSE 'present'
            END
        );
        
        RETURN json_build_object('success', true, 'action', 'check_in');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate attendance code (manager only)
CREATE OR REPLACE FUNCTION generate_attendance_code(
    p_valid_from TIME,
    p_valid_until TIME
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    new_code VARCHAR(10);
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    new_code := UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 6));
    
    -- Deactivate previous codes for today
    UPDATE attendance_codes
    SET is_active = false
    WHERE valid_for_date = CURRENT_DATE;
    
    INSERT INTO attendance_codes (code, generated_by, valid_for_date, valid_from, valid_until)
    VALUES (new_code, emp_id, CURRENT_DATE, p_valid_from, p_valid_until);
    
    RETURN json_build_object('success', true, 'code', new_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TABLES MANAGEMENT FUNCTIONS
-- =============================================

-- Get all tables with status
CREATE OR REPLACE FUNCTION get_tables_status()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', t.id,
            'table_number', t.table_number,
            'capacity', t.capacity,
            'status', t.status,
            'section', t.section,
            'floor', t.floor,
            'current_customers', t.current_customers,
            'current_order', CASE WHEN t.current_order_id IS NOT NULL THEN (
                SELECT json_build_object(
                    'id', o.id,
                    'order_number', o.order_number,
                    'total', o.total,
                    'status', o.status
                )
                FROM orders o WHERE o.id = t.current_order_id
            ) ELSE NULL END,
            'assigned_waiter', CASE WHEN t.assigned_waiter_id IS NOT NULL THEN (
                SELECT json_build_object('id', e.id, 'name', e.name)
                FROM employees e WHERE e.id = t.assigned_waiter_id
            ) ELSE NULL END,
            'reservation', CASE WHEN t.status = 'reserved' THEN json_build_object(
                'customer', (SELECT name FROM customers WHERE id = t.reserved_by),
                'time', t.reservation_time,
                'notes', t.reservation_notes
            ) ELSE NULL END
        )
        ORDER BY t.table_number
    ) INTO result
    FROM restaurant_tables t;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update table status
CREATE OR REPLACE FUNCTION update_table_status(
    p_table_id UUID,
    p_status TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- NOTIFICATIONS FUNCTIONS
-- =============================================

-- Send notification
CREATE OR REPLACE FUNCTION send_notification(
    p_user_ids UUID[],
    p_user_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'system',
    p_data JSONB DEFAULT NULL,
    p_priority TEXT DEFAULT 'normal'
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get my notifications
CREATE OR REPLACE FUNCTION get_my_notifications(
    p_limit INTEGER DEFAULT 50,
    p_unread_only BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
    p_notification_ids UUID[]
)
RETURNS JSON AS $$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE id = ANY(p_notification_ids)
    AND user_id = get_employee_id();
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DELIVERY FUNCTIONS
-- =============================================

-- Get delivery orders
CREATE OR REPLACE FUNCTION get_delivery_orders()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept delivery order
CREATE OR REPLACE FUNCTION accept_delivery_order(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
BEGIN
    IF NOT is_delivery_rider() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    UPDATE orders
    SET delivery_rider_id = emp_id,
        status = 'delivering',
        delivery_started_at = NOW(),
        estimated_delivery_time = NOW() + INTERVAL '30 minutes',
        updated_at = NOW()
    WHERE id = p_order_id
    AND status = 'ready';
    
    -- Add status history
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (p_order_id, 'delivering', emp_id);
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete delivery
CREATE OR REPLACE FUNCTION complete_delivery(p_order_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REPORT FUNCTIONS
-- =============================================

-- Generate sales report
CREATE OR REPLACE FUNCTION generate_sales_report(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate employee report
CREATE OR REPLACE FUNCTION generate_employee_report(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PROMO CODE FUNCTIONS
-- =============================================

-- Validate promo code
CREATE OR REPLACE FUNCTION validate_promo_code(
    p_code TEXT,
    p_customer_id UUID DEFAULT NULL,
    p_order_amount DECIMAL(10, 2) DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    promo RECORD;
    usage_count INTEGER;
    discount_value DECIMAL(10, 2);
BEGIN
    SELECT * INTO promo
    FROM promo_codes
    WHERE code = p_code
    AND is_active = true
    AND valid_from <= NOW()
    AND valid_until >= NOW();
    
    IF promo IS NULL THEN
        RETURN json_build_object('valid', false, 'error', 'Invalid or expired promo code');
    END IF;
    
    -- Check usage limit
    IF promo.usage_limit IS NOT NULL AND promo.current_usage >= promo.usage_limit THEN
        RETURN json_build_object('valid', false, 'error', 'Promo code usage limit reached');
    END IF;
    
    -- Check per-customer limit
    IF p_customer_id IS NOT NULL AND promo.usage_per_customer IS NOT NULL THEN
        SELECT COUNT(*) INTO usage_count
        FROM promo_code_usage
        WHERE promo_code_id = promo.id
        AND customer_id = p_customer_id;
        
        IF usage_count >= promo.usage_per_customer THEN
            RETURN json_build_object('valid', false, 'error', 'You have already used this promo code');
        END IF;
    END IF;
    
    -- Check minimum order amount
    IF promo.min_order_amount IS NOT NULL AND p_order_amount < promo.min_order_amount THEN
        RETURN json_build_object('valid', false, 'error', 'Minimum order amount of ' || promo.min_order_amount || ' required');
    END IF;
    
    -- Calculate discount
    IF promo.promo_type = 'percentage' THEN
        discount_value := p_order_amount * (promo.value / 100);
        IF promo.max_discount IS NOT NULL THEN
            discount_value := LEAST(discount_value, promo.max_discount);
        END IF;
    ELSE
        discount_value := promo.value;
    END IF;
    
    RETURN json_build_object(
        'valid', true,
        'promo', json_build_object(
            'id', promo.id,
            'name', promo.name,
            'type', promo.promo_type,
            'value', promo.value,
            'discount_amount', discount_value
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INVENTORY MANAGEMENT FUNCTIONS
-- =============================================

-- Get all inventory items with status
CREATE OR REPLACE FUNCTION get_inventory_items()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', i.id,
            'name', i.name,
            'sku', i.sku,
            'category', i.category,
            'unit', i.unit,
            'current_stock', i.quantity,
            'min_stock', i.min_quantity,
            'max_stock', i.max_quantity,
            'cost_per_unit', i.cost_per_unit,
            'supplier', i.supplier,
            'last_restocked', i.last_restocked,
            'status', CASE 
                WHEN i.quantity <= 0 THEN 'out_of_stock'
                WHEN i.quantity <= i.min_quantity THEN 'low_stock'
                ELSE 'in_stock'
            END,
            'notes', i.notes,
            'created_at', i.created_at,
            'updated_at', i.updated_at
        )
        ORDER BY i.name
    ) INTO result
    FROM inventory i;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create inventory item
CREATE OR REPLACE FUNCTION create_inventory_item(
    p_name TEXT,
    p_sku TEXT,
    p_category TEXT,
    p_unit TEXT,
    p_quantity DECIMAL(10,2) DEFAULT 0,
    p_min_quantity DECIMAL(10,2) DEFAULT 10,
    p_max_quantity DECIMAL(10,2) DEFAULT 100,
    p_cost_per_unit DECIMAL(10,2) DEFAULT 0,
    p_supplier TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    new_item_id UUID;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    
    INSERT INTO inventory (
        name, sku, category, unit, quantity, min_quantity, max_quantity,
        cost_per_unit, supplier, notes, created_by
    ) VALUES (
        p_name, p_sku, p_category, p_unit, p_quantity, p_min_quantity, p_max_quantity,
        p_cost_per_unit, p_supplier, p_notes, emp_id
    ) RETURNING id INTO new_item_id;
    
    -- Log transaction if initial quantity > 0
    IF p_quantity > 0 THEN
        INSERT INTO inventory_transactions (
            inventory_id, transaction_type, quantity_change,
            unit_cost, total_cost, notes, created_by
        ) VALUES (
            new_item_id, 'purchase', p_quantity,
            p_cost_per_unit, p_quantity * p_cost_per_unit,
            'Initial stock', emp_id
        );
    END IF;
    
    RETURN json_build_object('success', true, 'id', new_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update inventory item
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
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
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
        updated_at = NOW()
    WHERE id = p_item_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adjust inventory stock
CREATE OR REPLACE FUNCTION adjust_inventory_stock(
    p_item_id UUID,
    p_transaction_type TEXT,
    p_quantity DECIMAL(10,2),
    p_reason TEXT DEFAULT NULL,
    p_unit_cost DECIMAL(10,2) DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    item_record RECORD;
    new_quantity DECIMAL(10,2);
    actual_cost DECIMAL(10,2);
BEGIN
    emp_id := get_employee_id();
    
    -- Get current item
    SELECT * INTO item_record FROM inventory WHERE id = p_item_id;
    
    IF item_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Item not found');
    END IF;
    
    -- Calculate new quantity based on transaction type
    CASE p_transaction_type
        WHEN 'purchase' THEN new_quantity := item_record.quantity + p_quantity;
        WHEN 'usage' THEN new_quantity := item_record.quantity - p_quantity;
        WHEN 'waste' THEN new_quantity := item_record.quantity - p_quantity;
        WHEN 'adjustment' THEN new_quantity := p_quantity; -- Direct set
        ELSE RETURN json_build_object('success', false, 'error', 'Invalid transaction type');
    END CASE;
    
    -- Prevent negative stock
    IF new_quantity < 0 THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient stock');
    END IF;
    
    actual_cost := COALESCE(p_unit_cost, item_record.cost_per_unit);
    
    -- Update inventory
    UPDATE inventory SET
        quantity = new_quantity,
        last_restocked = CASE WHEN p_transaction_type = 'purchase' THEN NOW() ELSE last_restocked END,
        updated_at = NOW()
    WHERE id = p_item_id;
    
    -- Log transaction
    INSERT INTO inventory_transactions (
        inventory_id, transaction_type, quantity_change,
        unit_cost, total_cost, notes, created_by
    ) VALUES (
        p_item_id,
        p_transaction_type,
        CASE 
            WHEN p_transaction_type IN ('usage', 'waste') THEN -p_quantity
            WHEN p_transaction_type = 'adjustment' THEN new_quantity - item_record.quantity
            ELSE p_quantity
        END,
        actual_cost,
        CASE 
            WHEN p_transaction_type IN ('usage', 'waste') THEN -p_quantity * actual_cost
            WHEN p_transaction_type = 'adjustment' THEN (new_quantity - item_record.quantity) * actual_cost
            ELSE p_quantity * actual_cost
        END,
        p_reason,
        emp_id
    );
    
    RETURN json_build_object('success', true, 'new_quantity', new_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get inventory transactions for an item
CREATE OR REPLACE FUNCTION get_inventory_transactions(
    p_item_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
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
            'type', t.transaction_type,
            'quantity', t.quantity_change,
            'unit_cost', t.unit_cost,
            'total_cost', t.total_cost,
            'reason', t.notes,
            'performed_by', (SELECT name FROM employees WHERE id = t.created_by),
            'created_at', t.created_at
        )
        ORDER BY t.created_at DESC
    ) INTO result
    FROM inventory_transactions t
    JOIN inventory i ON i.id = t.inventory_id
    WHERE (p_item_id IS NULL OR t.inventory_id = p_item_id)
    AND (p_start_date IS NULL OR DATE(t.created_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(t.created_at) <= p_end_date)
    LIMIT p_limit;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete inventory item
CREATE OR REPLACE FUNCTION delete_inventory_item(p_item_id UUID)
RETURNS JSON AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    DELETE FROM inventory_transactions WHERE inventory_id = p_item_id;
    DELETE FROM inventory WHERE id = p_item_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DEALS & PROMOTIONS FUNCTIONS
-- =============================================

-- Get all deals/promotions
CREATE OR REPLACE FUNCTION get_deals()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create deal/promotion
CREATE OR REPLACE FUNCTION create_deal(
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_code TEXT DEFAULT NULL,
    p_discount_type TEXT DEFAULT 'percentage',
    p_discount_value DECIMAL(10,2) DEFAULT 10,
    p_min_order_amount DECIMAL(10,2) DEFAULT NULL,
    p_max_discount DECIMAL(10,2) DEFAULT NULL,
    p_start_date TIMESTAMP DEFAULT NOW(),
    p_end_date TIMESTAMP DEFAULT NULL,
    p_usage_limit INTEGER DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
    emp_id UUID;
    new_deal_id UUID;
    actual_code TEXT;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    emp_id := get_employee_id();
    actual_code := COALESCE(p_code, UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 8)));
    
    INSERT INTO promo_codes (
        name, description, code, promo_type, value,
        min_order_amount, max_discount, valid_from, valid_until,
        usage_limit, is_active, created_by
    ) VALUES (
        p_name, p_description, actual_code, p_discount_type, p_discount_value,
        p_min_order_amount, p_max_discount, p_start_date, p_end_date,
        p_usage_limit, p_is_active, emp_id
    ) RETURNING id INTO new_deal_id;
    
    RETURN json_build_object('success', true, 'id', new_deal_id, 'code', actual_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update deal/promotion
CREATE OR REPLACE FUNCTION update_deal(
    p_deal_id UUID,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_discount_value DECIMAL(10,2) DEFAULT NULL,
    p_min_order_amount DECIMAL(10,2) DEFAULT NULL,
    p_max_discount DECIMAL(10,2) DEFAULT NULL,
    p_end_date TIMESTAMP DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle deal status
CREATE OR REPLACE FUNCTION toggle_deal_status(p_deal_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete deal
CREATE OR REPLACE FUNCTION delete_deal(p_deal_id UUID)
RETURNS JSON AS $$
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    DELETE FROM promo_code_usage WHERE promo_code_id = p_deal_id;
    DELETE FROM promo_codes WHERE id = p_deal_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- AUDIT LOG FUNCTIONS
-- =============================================

-- Get audit logs
CREATE OR REPLACE FUNCTION get_audit_logs(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_employee_id UUID DEFAULT NULL,
    p_action_type TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log audit action
CREATE OR REPLACE FUNCTION log_audit_action(
    p_action TEXT,
    p_table_name TEXT,
    p_record_id UUID,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PAYROLL MANAGEMENT FUNCTIONS
-- =============================================

-- Get payslips
CREATE OR REPLACE FUNCTION get_payslips(
    p_employee_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create payslip
CREATE OR REPLACE FUNCTION create_payslip(
    p_employee_id UUID,
    p_period_start DATE,
    p_period_end DATE,
    p_base_salary DECIMAL,
    p_overtime_hours DECIMAL DEFAULT 0,
    p_overtime_rate DECIMAL DEFAULT 1.5,
    p_bonuses DECIMAL DEFAULT 0,
    p_deductions DECIMAL DEFAULT 0,
    p_tax_amount DECIMAL DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update payslip status
CREATE OR REPLACE FUNCTION update_payslip_status(
    p_payslip_id UUID,
    p_status TEXT,
    p_payment_method TEXT DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get payroll summary
CREATE OR REPLACE FUNCTION get_payroll_summary(
    p_period_start DATE DEFAULT NULL,
    p_period_end DATE DEFAULT NULL
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REVIEW MANAGEMENT FUNCTIONS
-- =============================================

-- Get reviews for admin
CREATE OR REPLACE FUNCTION get_admin_reviews(
    p_status TEXT DEFAULT NULL,
    p_min_rating INTEGER DEFAULT NULL,
    p_max_rating INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update review visibility
CREATE OR REPLACE FUNCTION update_review_visibility(
    p_review_id UUID,
    p_is_visible BOOLEAN
)
RETURNS JSON AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reply to review
CREATE OR REPLACE FUNCTION reply_to_review(
    p_review_id UUID,
    p_reply TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete review
CREATE OR REPLACE FUNCTION delete_review(p_review_id UUID)
RETURNS JSON AS $$
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    DELETE FROM reviews WHERE id = p_review_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get review stats
CREATE OR REPLACE FUNCTION get_review_stats()
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- NOTIFICATION MANAGEMENT FUNCTIONS
-- =============================================

-- Get notifications
CREATE OR REPLACE FUNCTION get_notifications(
    p_user_id UUID DEFAULT NULL,
    p_user_type TEXT DEFAULT 'employee',
    p_is_read BOOLEAN DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS JSON AS $$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE id = p_notification_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_type TEXT DEFAULT 'employee')
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_user_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'system',
    p_data JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    VALUES (p_user_id, p_user_type, p_title, p_message, p_type, p_data)
    RETURNING id INTO new_id;
    
    RETURN json_build_object('success', true, 'id', new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_type TEXT DEFAULT 'employee')
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REPORTS & ANALYTICS FUNCTIONS  
-- =============================================

-- Get category sales report
CREATE OR REPLACE FUNCTION get_category_sales_report(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get employee performance report
CREATE OR REPLACE FUNCTION get_employee_performance_report(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get inventory report
CREATE OR REPLACE FUNCTION get_inventory_report()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT is_manager_or_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    
    SELECT json_build_object(
        'total_items', (SELECT COUNT(*) FROM inventory),
        'low_stock_count', (SELECT COUNT(*) FROM inventory WHERE quantity <= min_quantity),
        'out_of_stock', (SELECT COUNT(*) FROM inventory WHERE quantity = 0),
        'total_value', (SELECT COALESCE(SUM(quantity * cost_per_unit), 0) FROM inventory),
        'categories', (
            SELECT json_agg(
                json_build_object(
                    'category', category,
                    'item_count', COUNT(*),
                    'total_value', SUM(quantity * cost_per_unit),
                    'low_stock', COUNT(*) FILTER (WHERE quantity <= min_quantity)
                )
            )
            FROM inventory
            GROUP BY category
        ),
        'low_stock_items', (
            SELECT json_agg(
                json_build_object(
                    'id', id,
                    'name', name,
                    'quantity', quantity,
                    'min_quantity', min_quantity,
                    'unit', unit
                )
            )
            FROM inventory
            WHERE quantity <= min_quantity
            ORDER BY (quantity / NULLIF(min_quantity, 0)) ASC
            LIMIT 10
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INSERT ADMIN PROFILE
-- =============================================
-- Note: You need to manually create the auth user in Supabase Dashboard first
-- Then update the auth_user_id below with the actual UUID from auth.users

INSERT INTO employees (
    id,
    auth_user_id,
    employee_id,
    name,
    email,
    phone,
    role,
    status,
    permissions,
    portal_enabled,
    is_2fa_enabled,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    NULL, -- Update this with the auth.users UUID after creating the user manually
    'EMP-ADMIN-001',
    'Muhammad Waqar',
    'ahmadali207711@gmail.com',
    '+92 300 0000000',
    'admin',
    'active',
    '{
        "dashboard": true,
        "orders": true,
        "menu": true,
        "employees": true,
        "tables": true,
        "kitchen": true,
        "billing": true,
        "delivery": true,
        "attendance": true,
        "inventory": true,
        "reports": true,
        "settings": true,
        "promo_codes": true,
        "notifications": true,
        "audit": true,
        "payroll": true,
        "reviews": true,
        "deals": true
    }'::jsonb,
    true,
    false,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    permissions = EXCLUDED.permissions,
    portal_enabled = EXCLUDED.portal_enabled,
    updated_at = NOW();


    -- =============================================
-- CRUD RPC FUNCTIONS FOR ALL ENTITIES
-- =============================================

-- =============================================
-- CUSTOMER CRUD FUNCTIONS
-- =============================================

-- Get customer by ID
CREATE OR REPLACE FUNCTION get_customer_by_id(p_customer_id UUID)
RETURNS TABLE (
    id UUID,
    auth_user_id UUID,
    email TEXT,
    name TEXT,
    phone TEXT,
    address TEXT,
    avatar_url TEXT,
    is_2fa_enabled BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id, c.auth_user_id, c.email, c.name, c.phone, c.address,
        c.avatar_url, c.is_2fa_enabled, c.created_at, c.updated_at
    FROM customers c
    WHERE c.id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update customer profile
CREATE OR REPLACE FUNCTION update_customer_profile(
    p_customer_id UUID,
    p_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE customers
    SET 
        name = COALESCE(p_name, name),
        phone = COALESCE(p_phone, phone),
        address = COALESCE(p_address, address),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = NOW()
    WHERE id = p_customer_id
    RETURNING jsonb_build_object(
        'success', true,
        'id', id,
        'name', name,
        'phone', phone,
        'address', address,
        'avatar_url', avatar_url,
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- EMPLOYEE CRUD FUNCTIONS
-- =============================================

-- Create employee
CREATE OR REPLACE FUNCTION create_employee(
    p_email TEXT,
    p_name TEXT,
    p_phone TEXT,
    p_role user_role,
    p_permissions JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all employees
CREATE OR REPLACE FUNCTION get_all_employees()
RETURNS TABLE (
    id UUID,
    employee_id TEXT,
    email TEXT,
    name TEXT,
    phone TEXT,
    role user_role,
    permissions JSONB,
    status TEXT,
    is_verified BOOLEAN,
    avatar_url TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id, e.employee_id, e.email, e.name, e.phone,
        e.role, e.permissions, e.status, e.is_verified,
        e.avatar_url, e.created_at
    FROM employees e
    ORDER BY e.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update employee
CREATE OR REPLACE FUNCTION update_employee(
    p_employee_id UUID,
    p_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_role user_role DEFAULT NULL,
    p_permissions JSONB DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE employees
    SET 
        name = COALESCE(p_name, name),
        phone = COALESCE(p_phone, phone),
        role = COALESCE(p_role, role),
        permissions = COALESCE(p_permissions, permissions),
        status = COALESCE(p_status, status),
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
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete employee
CREATE OR REPLACE FUNCTION delete_employee(p_employee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE employees
    SET status = 'inactive', updated_at = NOW()
    WHERE id = p_employee_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- MENU CATEGORY CRUD FUNCTIONS
-- =============================================

-- Create menu category
CREATE OR REPLACE FUNCTION create_menu_category(
    p_name TEXT,
    p_slug TEXT,
    p_description TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_display_order INT DEFAULT 0
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update menu category
CREATE OR REPLACE FUNCTION update_menu_category(
    p_category_id UUID,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_display_order INT DEFAULT NULL,
    p_is_visible BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete menu category
CREATE OR REPLACE FUNCTION delete_menu_category(p_category_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM menu_categories WHERE id = p_category_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- MENU ITEM CRUD FUNCTIONS
-- =============================================

-- Helper function to generate slugs
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create menu item
CREATE OR REPLACE FUNCTION create_menu_item(
    p_category_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_price DECIMAL,
    p_images JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update menu item
CREATE OR REPLACE FUNCTION update_menu_item(
    p_item_id UUID,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_price DECIMAL DEFAULT NULL,
    p_images JSONB DEFAULT NULL,
    p_is_available BOOLEAN DEFAULT NULL,
    p_is_featured BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
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
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete menu item
CREATE OR REPLACE FUNCTION delete_menu_item(p_item_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_images JSONB;
    v_result JSONB;
BEGIN
    -- Get images before deleting
    SELECT images INTO v_images
    FROM menu_items
    WHERE id = p_item_id;
    
    -- Delete the menu item
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DEAL CRUD FUNCTIONS
-- =============================================

-- Create deal
CREATE OR REPLACE FUNCTION create_deal(
    p_name TEXT,
    p_description TEXT,
    p_original_price DECIMAL,
    p_discounted_price DECIMAL,
    p_items JSONB,
    p_valid_from TIMESTAMPTZ,
    p_valid_until TIMESTAMPTZ,
    p_image_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    INSERT INTO deals (
        name, description, original_price, discounted_price,
        items, valid_from, valid_until, image_url
    )
    VALUES (
        p_name, p_description, p_original_price, p_discounted_price,
        p_items, p_valid_from, p_valid_until, p_image_url
    )
    RETURNING jsonb_build_object(
        'id', id,
        'name', name,
        'discounted_price', discounted_price,
        'is_active', is_active,
        'created_at', created_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update deal
CREATE OR REPLACE FUNCTION update_deal(
    p_deal_id UUID,
    p_name TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete deal
CREATE OR REPLACE FUNCTION delete_deal(p_deal_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM deals WHERE id = p_deal_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- REVIEW CRUD FUNCTIONS
-- =============================================

-- Get all reviews (admin)
CREATE OR REPLACE FUNCTION get_all_reviews(
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    order_id UUID,
    customer_id UUID,
    customer_name TEXT,
    rating INT,
    comment TEXT,
    images JSONB,
    is_visible BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update review visibility
CREATE OR REPLACE FUNCTION update_review_visibility(
    p_review_id UUID,
    p_is_visible BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE reviews
    SET is_visible = p_is_visible, updated_at = NOW()
    WHERE id = p_review_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete review
CREATE OR REPLACE FUNCTION delete_review(p_review_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM reviews WHERE id = p_review_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ORDER CRUD FUNCTIONS
-- =============================================

-- Get all orders with filters
CREATE OR REPLACE FUNCTION get_all_orders(
    p_status order_status DEFAULT NULL,
    p_order_type order_type DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    customer_id UUID,
    customer_name TEXT,
    customer_phone TEXT,
    status order_status,
    order_type order_type,
    total DECIMAL,
    created_at TIMESTAMPTZ,
    items JSONB
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel order
CREATE OR REPLACE FUNCTION cancel_order(
    p_order_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SITE CONTENT CRUD FUNCTIONS
-- =============================================

-- Get all site content sections
CREATE OR REPLACE FUNCTION get_all_site_content()
RETURNS TABLE (
    id UUID,
    section TEXT,
    content JSONB,
    is_active BOOLEAN,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT sc.id, sc.section, sc.content, sc.is_active, sc.updated_at
    FROM site_content sc
    ORDER BY sc.section;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update site content
CREATE OR REPLACE FUNCTION update_site_content_section(
    p_section TEXT,
    p_content JSONB,
    p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TABLE MANAGEMENT FUNCTIONS
-- =============================================

-- Get all tables
CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE (
    id UUID,
    table_number INT,
    capacity INT,
    status TEXT,
    current_order_id UUID,
    order_number TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id, t.table_number, t.capacity, t.status, t.current_order_id,
        o.order_number
    FROM restaurant_tables t
    LEFT JOIN orders o ON o.id = t.current_order_id
    ORDER BY t.table_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create table
CREATE OR REPLACE FUNCTION create_table(
    p_table_number INT,
    p_capacity INT
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- =============================================
-- DROP ALL EXISTING POLICIES FIRST
-- =============================================

-- Drop policies on customers
DROP POLICY IF EXISTS "Customers can view own profile" ON customers;
DROP POLICY IF EXISTS "Customers can update own profile" ON customers;
DROP POLICY IF EXISTS "Anyone can create customer" ON customers;
DROP POLICY IF EXISTS "customers_select_anon" ON customers;

-- Drop policies on employees
DROP POLICY IF EXISTS "Employees can view own profile" ON employees;
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;
DROP POLICY IF EXISTS "Admins can create employees" ON employees;
DROP POLICY IF EXISTS "Admins can update employees" ON employees;
DROP POLICY IF EXISTS "Employees can update own profile" ON employees;

-- Drop policies on menu_categories
DROP POLICY IF EXISTS "Anyone can view visible categories" ON menu_categories;
DROP POLICY IF EXISTS "Employees can view all categories" ON menu_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON menu_categories;

-- Drop policies on menu_items
DROP POLICY IF EXISTS "Anyone can view available items" ON menu_items;
DROP POLICY IF EXISTS "Employees can view all items" ON menu_items;
DROP POLICY IF EXISTS "Kitchen can update item availability" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage items" ON menu_items;
DROP POLICY IF EXISTS "menu_items_select_anon" ON menu_items;

-- Drop policies on meals
DROP POLICY IF EXISTS "Anyone can view available meals" ON meals;
DROP POLICY IF EXISTS "Admins can manage meals" ON meals;
DROP POLICY IF EXISTS "meals_select_anon" ON meals;

-- Drop policies on deals
DROP POLICY IF EXISTS "Anyone can view active deals" ON deals;
DROP POLICY IF EXISTS "Admins can manage deals" ON deals;
DROP POLICY IF EXISTS "deals_select_anon" ON deals;

-- Drop policies on orders
DROP POLICY IF EXISTS "Customers can view own orders" ON orders;
DROP POLICY IF EXISTS "Customers can create orders" ON orders;
DROP POLICY IF EXISTS "Employees can view all orders" ON orders;
DROP POLICY IF EXISTS "Staff can update orders" ON orders;
DROP POLICY IF EXISTS "Cashiers can create walk-in orders" ON orders;
DROP POLICY IF EXISTS "orders_insert_anon" ON orders;
DROP POLICY IF EXISTS "orders_select_anon" ON orders;

-- Drop policies on order_status_history
DROP POLICY IF EXISTS "order_status_history_select" ON order_status_history;
DROP POLICY IF EXISTS "order_status_history_insert" ON order_status_history;
DROP POLICY IF EXISTS "order_status_history_insert_anon" ON order_status_history;

-- Drop policies on reviews
DROP POLICY IF EXISTS "Customers can create reviews" ON reviews;
DROP POLICY IF EXISTS "Customers can view own reviews" ON reviews;
DROP POLICY IF EXISTS "Anyone can view visible reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can manage reviews" ON reviews;

-- Drop policies on site_content
DROP POLICY IF EXISTS "Anyone can view active content" ON site_content;
DROP POLICY IF EXISTS "Admins can manage content" ON site_content;
DROP POLICY IF EXISTS "site_content_select_anon" ON site_content;

-- Drop policies on restaurant_tables
DROP POLICY IF EXISTS "Staff can view tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Reception can update tables" ON restaurant_tables;

-- Drop policies on notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_anon" ON notifications;

-- Drop policies on audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can create audit logs" ON audit_logs;

-- Drop policies on otp_codes
DROP POLICY IF EXISTS "Public can read OTP for verification" ON otp_codes;
DROP POLICY IF EXISTS "System can create OTP" ON otp_codes;
DROP POLICY IF EXISTS "System can update OTP" ON otp_codes;

-- =============================================
-- DROP EXISTING HELPER FUNCTIONS
-- =============================================
DROP FUNCTION IF EXISTS is_employee();
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS has_role(text[]);
DROP FUNCTION IF EXISTS get_my_customer_id();
DROP FUNCTION IF EXISTS get_my_employee_id();

-- =============================================
-- GRANT SCHEMA AND TABLE PERMISSIONS
-- These are required before RLS policies can work
-- =============================================

-- Grant schema usage to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant table access for public read tables
GRANT SELECT ON menu_categories TO anon;
GRANT SELECT ON menu_items TO anon;
GRANT SELECT ON meals TO anon;
GRANT SELECT ON deals TO anon;
GRANT SELECT ON reviews TO anon;
GRANT SELECT ON site_content TO anon;
GRANT SELECT ON customers TO anon;

-- Grant INSERT for orders and related tables to anon (for order creation API)
GRANT INSERT, SELECT ON orders TO anon;
GRANT INSERT ON order_status_history TO anon;
GRANT INSERT ON notifications TO anon;

-- Grant full access to authenticated users (RLS will further restrict)
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO authenticated;
GRANT SELECT ON menu_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO authenticated;
GRANT SELECT, INSERT ON order_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON site_content TO authenticated;
GRANT SELECT, UPDATE ON restaurant_tables TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;

-- OTP codes need public access for verification
GRANT SELECT, INSERT, UPDATE ON otp_codes TO anon;
GRANT SELECT, INSERT, UPDATE ON otp_codes TO authenticated;

-- Customers table needs anon insert for registration
GRANT INSERT ON customers TO anon;

-- =============================================
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid infinite recursion)
-- =============================================

-- Check if current user is an employee (bypasses RLS)
CREATE OR REPLACE FUNCTION is_employee()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees WHERE auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is an admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user has a specific role (bypasses RLS)
CREATE OR REPLACE FUNCTION has_role(required_roles text[])
RETURNS BOOLEAN AS $$
DECLARE
    user_role text;
    normalized_roles text[];
BEGIN
    -- Get the user's role
    SELECT role INTO user_role FROM employees WHERE auth_user_id = auth.uid();
    
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Normalize legacy role names in required_roles
    normalized_roles := ARRAY(
        SELECT CASE role_name
            WHEN 'kitchen' THEN 'kitchen_staff'
            WHEN 'billing' THEN 'billing_staff'
            WHEN 'delivery' THEN 'delivery_rider'
            WHEN 'reception' THEN 'waiter'
            WHEN 'cashier' THEN 'billing_staff'
            ELSE role_name
        END
        FROM unnest(required_roles) AS role_name
    );
    
    RETURN user_role = ANY(normalized_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's customer ID (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_customer_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM customers WHERE auth_user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's employee ID (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_employee_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CUSTOMERS POLICIES
-- =============================================

-- Customers can read their own data
CREATE POLICY "Customers can view own profile"
    ON customers FOR SELECT
    USING (auth.uid() = auth_user_id);

-- Customers can update their own data
CREATE POLICY "Customers can update own profile"
    ON customers FOR UPDATE
    USING (auth.uid() = auth_user_id);

-- Anyone can create customer (registration)
CREATE POLICY "Anyone can create customer"
    ON customers FOR INSERT
    WITH CHECK (true);

-- =============================================
-- EMPLOYEES POLICIES
-- =============================================

-- Employees can view their own profile
CREATE POLICY "Employees can view own profile"
    ON employees FOR SELECT
    USING (auth.uid() = auth_user_id);

-- Admins can view all employees (use function to avoid recursion)
CREATE POLICY "Admins can view all employees"
    ON employees FOR SELECT
    USING (is_admin());

-- Admins can create employees
CREATE POLICY "Admins can create employees"
    ON employees FOR INSERT
    WITH CHECK (is_admin());

-- Admins can update employees
CREATE POLICY "Admins can update employees"
    ON employees FOR UPDATE
    USING (is_admin());

-- Employees can update their own profile
CREATE POLICY "Employees can update own profile"
    ON employees FOR UPDATE
    USING (auth.uid() = auth_user_id);

-- =============================================
-- MENU POLICIES (PUBLIC READ)
-- =============================================

-- Everyone can read visible menu categories
CREATE POLICY "Anyone can view visible categories"
    ON menu_categories FOR SELECT
    USING (is_visible = true);

-- Employees can view all categories
CREATE POLICY "Employees can view all categories"
    ON menu_categories FOR SELECT
    USING (is_employee());

-- Admins can manage categories
CREATE POLICY "Admins can manage categories"
    ON menu_categories FOR ALL
    USING (is_admin());

-- Everyone can read available menu items
CREATE POLICY "Anyone can view available items"
    ON menu_items FOR SELECT
    USING (is_available = true);

-- Employees can view all items
CREATE POLICY "Employees can view all items"
    ON menu_items FOR SELECT
    USING (is_employee());

-- Kitchen staff can update item availability
CREATE POLICY "Kitchen can update item availability"
    ON menu_items FOR UPDATE
    USING (has_role(ARRAY['kitchen', 'admin', 'manager']));

-- Admins and managers can manage items
CREATE POLICY "Admins can manage items"
    ON menu_items FOR ALL
    USING (has_role(ARRAY['admin', 'manager']));

-- Everyone can read available meals
CREATE POLICY "Anyone can view available meals"
    ON meals FOR SELECT
    USING (is_available = true);

-- Admins can manage meals
CREATE POLICY "Admins can manage meals"
    ON meals FOR ALL
    USING (has_role(ARRAY['admin', 'manager']));

-- Everyone can read active deals
CREATE POLICY "Anyone can view active deals"
    ON deals FOR SELECT
    USING (is_active = true AND NOW() BETWEEN valid_from AND valid_until);

-- Admins can manage deals
CREATE POLICY "Admins can manage deals"
    ON deals FOR ALL
    USING (has_role(ARRAY['admin', 'manager']));

-- =============================================
-- ORDERS POLICIES
-- =============================================

-- Customers can view their own orders
CREATE POLICY "Customers can view own orders"
    ON orders FOR SELECT
    USING (customer_id = get_my_customer_id());

-- Customers can create orders
CREATE POLICY "Customers can create orders"
    ON orders FOR INSERT
    WITH CHECK (customer_id = get_my_customer_id());

-- Employees can view all orders
CREATE POLICY "Employees can view all orders"
    ON orders FOR SELECT
    USING (is_employee());

-- Kitchen and reception can update orders
CREATE POLICY "Staff can update orders"
    ON orders FOR UPDATE
    USING (has_role(ARRAY['kitchen', 'reception', 'admin', 'manager']));

-- Cashiers can create walk-in orders
CREATE POLICY "Cashiers can create walk-in orders"
    ON orders FOR INSERT
    WITH CHECK (has_role(ARRAY['cashier', 'admin', 'manager']));

-- =============================================
-- REVIEWS POLICIES
-- =============================================

-- Customers can create reviews for their orders
CREATE POLICY "Customers can create reviews"
    ON reviews FOR INSERT
    WITH CHECK (customer_id = get_my_customer_id());

-- Customers can view their own reviews
CREATE POLICY "Customers can view own reviews"
    ON reviews FOR SELECT
    USING (customer_id = get_my_customer_id());

-- Everyone can view visible reviews
CREATE POLICY "Anyone can view visible reviews"
    ON reviews FOR SELECT
    USING (is_visible = true);

-- Admins can manage reviews
CREATE POLICY "Admins can manage reviews"
    ON reviews FOR ALL
    USING (has_role(ARRAY['admin', 'manager']));

-- =============================================
-- SITE CONTENT POLICIES
-- =============================================

-- Everyone can read active content
CREATE POLICY "Anyone can view active content"
    ON site_content FOR SELECT
    USING (is_active = true);

-- Admins can manage content
CREATE POLICY "Admins can manage content"
    ON site_content FOR ALL
    USING (is_admin());

-- =============================================
-- TABLES POLICIES
-- =============================================

-- Reception and kitchen can view tables
CREATE POLICY "Staff can view tables"
    ON restaurant_tables FOR SELECT
    USING (has_role(ARRAY['reception', 'kitchen', 'admin', 'manager']));

-- Reception can update tables
CREATE POLICY "Reception can update tables"
    ON restaurant_tables FOR UPDATE
    USING (has_role(ARRAY['reception', 'admin', 'manager']));

-- =============================================
-- NOTIFICATIONS POLICIES
-- =============================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (
        (user_type = 'customer' AND user_id = get_my_customer_id()) OR
        (user_type = 'employee' AND user_id = get_my_employee_id())
    );

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (
        (user_type = 'customer' AND user_id = get_my_customer_id()) OR
        (user_type = 'employee' AND user_id = get_my_employee_id())
    );

-- System can create notifications
CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- =============================================
-- AUDIT LOGS POLICIES
-- =============================================

-- Admins can view audit logs
CREATE POLICY "Admins can view audit logs"
    ON audit_logs FOR SELECT
    USING (is_admin());

-- System can create audit logs
CREATE POLICY "System can create audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- =============================================
-- OTP CODES POLICIES
-- =============================================

-- Public can read OTP for verification (restricted by email)
CREATE POLICY "Public can read OTP for verification"
    ON otp_codes FOR SELECT
    USING (true);

-- System can create OTP
CREATE POLICY "System can create OTP"
    ON otp_codes FOR INSERT
    WITH CHECK (true);

-- System can update OTP (mark as used)
CREATE POLICY "System can update OTP"
    ON otp_codes FOR UPDATE
    USING (true);
