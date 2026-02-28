-- Returns the real primary key columns for every table in the public schema.
-- Used by the backup generator to produce correct ON CONFLICT clauses.

CREATE OR REPLACE FUNCTION get_table_primary_keys()
RETURNS TABLE(table_name TEXT, pk_columns TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kcu.table_name::TEXT,
    array_agg(kcu.column_name::TEXT ORDER BY kcu.ordinal_position) AS pk_columns
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.constraint_schema = kcu.constraint_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.constraint_schema = 'public'
  GROUP BY kcu.table_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_table_primary_keys() TO authenticated;
