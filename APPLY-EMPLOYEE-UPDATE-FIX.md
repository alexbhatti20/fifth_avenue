# Apply Employee Settings Fix

## Step 1: Apply SQL Migration to Supabase

You need to run this SQL in your Supabase SQL Editor:

### Go to Supabase Dashboard
1. Open your Supabase project
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the SQL below
5. Click **Run**

### SQL to Execute:

```sql
-- Update employee_complete RPC function
CREATE OR REPLACE FUNCTION update_employee_complete(
  p_employee_id UUID,
  p_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Update employee with only provided fields
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

  IF v_updated THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data)
    VALUES ('update_employee', 'employees', p_employee_id, v_old_data, p_data);
  END IF;

  RETURN jsonb_build_object(
    'success', v_updated,
    'message', CASE WHEN v_updated THEN 'Employee updated successfully' ELSE 'No changes made' END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_employee_complete(UUID, JSONB) TO authenticated;
```

## Step 2: Check Your Employee Data

Run this query to see your current employee data:

```sql
SELECT 
  id,
  name,
  email,
  hired_date,
  avatar_url,
  phone,
  address,
  emergency_contact
FROM employees
WHERE email = 'your-email@gmail.com';  -- Replace with your email
```

## Step 3: Set Default Hired Date (if NULL)

If `hired_date` is NULL, run this:

```sql
UPDATE employees
SET hired_date = created_at::DATE
WHERE hired_date IS NULL;
```

## Step 4: Test the Update

1. Go back to your app
2. Navigate to Settings > Personal
3. Try uploading a profile photo
4. Update any field
5. Click Save
6. Check if the data updates

## Troubleshooting

If still not working:

1. **Check browser console (F12)** - Look for errors
2. **Check Supabase logs** - Go to Supabase > Logs > API
3. **Verify RLS policies** - Make sure employees can update their own records

### Check RLS Policy:

```sql
-- Check if update policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'employees' 
AND cmd = 'UPDATE';
```

If no update policy exists, create one:

```sql
-- Allow employees to update their own record
CREATE POLICY "Employees can update own profile"
ON employees
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());
```
