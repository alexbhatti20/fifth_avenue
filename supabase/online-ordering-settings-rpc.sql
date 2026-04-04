BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (id)
);

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS id uuid,
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS value jsonb,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.system_settings
SET id = gen_random_uuid()
WHERE id IS NULL;

UPDATE public.system_settings
SET value = '{}'::jsonb
WHERE value IS NULL;

ALTER TABLE public.system_settings
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN key SET NOT NULL,
  ALTER COLUMN value SET DEFAULT '{}'::jsonb,
  ALTER COLUMN value SET NOT NULL;

DO $$
DECLARE
  v_pk_name text;
  v_pk_cols text[];
BEGIN
  SELECT c.conname,
         array_agg(a.attname ORDER BY u.ordinality)
  INTO v_pk_name, v_pk_cols
  FROM pg_constraint c
  JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ordinality) ON true
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = u.attnum
  WHERE c.conrelid = 'public.system_settings'::regclass
    AND c.contype = 'p'
  GROUP BY c.conname;

  IF v_pk_name IS NOT NULL
     AND (array_length(v_pk_cols, 1) <> 1 OR v_pk_cols[1] <> 'id') THEN
    EXECUTE format('ALTER TABLE public.system_settings DROP CONSTRAINT %I', v_pk_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.system_settings'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.system_settings
      ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.system_settings'::regclass
      AND c.contype = 'u'
      AND a.attname = 'key'
      AND array_length(c.conkey, 1) = 1
  ) THEN
    ALTER TABLE public.system_settings
      ADD CONSTRAINT system_settings_key_key UNIQUE (key);
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_settings'
      AND column_name = 'value'
      AND udt_name = 'json'
  ) THEN
    ALTER TABLE public.system_settings
      ALTER COLUMN value TYPE jsonb USING value::jsonb;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.system_settings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.system_settings_set_updated_at();

INSERT INTO public.system_settings (key, value, description)
VALUES (
  'online_ordering_settings',
  jsonb_build_object(
    'enabled', true,
    'disabled_message', 'Online ordering is currently unavailable. Please visit us in-store or try again later.'
  ),
  'Controls whether customers can add to cart and place online orders'
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.system_settings s
SET
  value = jsonb_build_object(
    'enabled', COALESCE((s.value->>'enabled')::boolean, true),
    'disabled_message', COALESCE(NULLIF(s.value->>'disabled_message', ''), 'Online ordering is currently unavailable. Please visit us in-store or try again later.')
  ),
  description = COALESCE(s.description, 'Controls whether customers can add to cart and place online orders')
WHERE s.key = 'online_ordering_settings';

CREATE OR REPLACE FUNCTION public.is_admin_from_jwt()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.auth_user_id = v_uid
      AND e.role = 'admin'
  );
END
$$;

REVOKE ALL ON FUNCTION public.is_admin_from_jwt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_from_jwt() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_online_ordering_setting()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_value jsonb;
  v_updated_at timestamptz;
  v_enabled boolean;
  v_message text;
BEGIN
  SELECT s.value, s.updated_at
  INTO v_value, v_updated_at
  FROM public.system_settings s
  WHERE s.key = 'online_ordering_settings'
  LIMIT 1;

  v_enabled := COALESCE((v_value->>'enabled')::boolean, true);
  v_message := COALESCE(NULLIF(v_value->>'disabled_message', ''), 'Online ordering is currently unavailable. Please visit us in-store or try again later.');

  RETURN jsonb_build_object(
    'enabled', v_enabled,
    'disabled_message', v_message,
    'updated_at', v_updated_at
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_online_ordering_setting() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_online_ordering_setting() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_online_ordering_setting_internal()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin_from_jwt() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized. Admin access required.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'settings', public.get_online_ordering_setting()
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_online_ordering_setting_internal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_online_ordering_setting_internal() TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_online_ordering_setting_internal(
  p_enabled boolean,
  p_disabled_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message text;
  v_now timestamptz;
BEGIN
  IF NOT public.is_admin_from_jwt() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized. Admin access required.'
    );
  END IF;

  v_message := COALESCE(NULLIF(trim(p_disabled_message), ''), 'Online ordering is currently unavailable. Please visit us in-store or try again later.');
  v_now := now();

  INSERT INTO public.system_settings (key, value, description, created_at, updated_at)
  VALUES (
    'online_ordering_settings',
    jsonb_build_object(
      'enabled', COALESCE(p_enabled, true),
      'disabled_message', v_message
    ),
    'Controls whether customers can add to cart and place online orders',
    v_now,
    v_now
  )
  ON CONFLICT (key)
  DO UPDATE SET
    value = jsonb_build_object(
      'enabled', COALESCE(p_enabled, true),
      'disabled_message', v_message
    ),
    description = EXCLUDED.description,
    updated_at = v_now;

  RETURN jsonb_build_object(
    'success', true,
    'settings', jsonb_build_object(
      'enabled', COALESCE(p_enabled, true),
      'disabled_message', v_message,
      'updated_at', v_now
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.upsert_online_ordering_setting_internal(boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_online_ordering_setting_internal(boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_online_ordering_enabled()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((public.get_online_ordering_setting()->>'enabled')::boolean, true)
$$;

REVOKE ALL ON FUNCTION public.is_online_ordering_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_online_ordering_enabled() TO anon, authenticated;

COMMIT;

-- Quick verify queries:
-- SELECT public.get_online_ordering_setting();
-- SELECT public.is_online_ordering_enabled();
