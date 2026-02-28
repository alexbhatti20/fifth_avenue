-- =============================================
-- ZOIRO BROAST HUB - BACKUP HELPER RPC FUNCTIONS
-- Run this in Supabase SQL Editor once
-- =============================================

-- 1) List all public tables with approximate row counts
CREATE OR REPLACE FUNCTION list_backup_tables()
RETURNS TABLE(table_name TEXT, row_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    COALESCE(s.n_live_tup, 0)::BIGINT
  FROM pg_tables t
  LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END;
$$;

GRANT EXECUTE ON FUNCTION list_backup_tables() TO authenticated;


-- 2) Return FK dependency map so we can order INSERTs correctly
CREATE OR REPLACE FUNCTION get_fk_dependency_map()
RETURNS TABLE(child_table TEXT, parent_table TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.table_name::TEXT  AS child_table,
    ccu.table_name::TEXT AS parent_table
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.constraint_column_usage AS ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.constraint_schema = ccu.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema   = 'public'
    AND ccu.table_schema  = 'public'
    AND tc.table_name    <> ccu.table_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_fk_dependency_map() TO authenticated;
