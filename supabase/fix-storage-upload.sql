-- =============================================
-- FIX STORAGE UPLOAD ISSUE - SIMPLE VERSION
-- Run this entire script in Supabase SQL Editor
-- This will allow authenticated users to upload images
-- =============================================

-- 1. Drop ALL existing storage policies (clean slate)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON storage.objects';
    END LOOP;
END $$;

-- 2. Create simple, permissive policies for avatars bucket
CREATE POLICY "avatars_authenticated_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 3. Create simple policies for images bucket
CREATE POLICY "images_authenticated_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'images')
WITH CHECK (bucket_id = 'images');

CREATE POLICY "images_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'images');

-- 4. Create simple policies for reviews bucket
CREATE POLICY "reviews_authenticated_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'reviews')
WITH CHECK (bucket_id = 'reviews');

CREATE POLICY "reviews_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'reviews');

-- 5. Create simple policies for documents bucket (if exists)
CREATE POLICY "documents_authenticated_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- 6. Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;

-- =============================================
-- You should see 7 policies listed above:
-- - avatars_authenticated_all
-- - avatars_public_read  
-- - documents_authenticated_all
-- - images_authenticated_all
-- - images_public_read
-- - reviews_authenticated_all
-- - reviews_public_read
-- =============================================
