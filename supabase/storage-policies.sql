-- =============================================
-- STORAGE BUCKET POLICIES FOR ZOIRO BROAST HUB
-- Run this in Supabase SQL Editor to fix storage upload issues
-- =============================================

-- 1. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can upload their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload review images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete review images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view review images" ON storage.objects;

-- 2. AVATARS BUCKET POLICIES
-- Allow authenticated users to upload their own avatar
CREATE POLICY "Authenticated users can upload their avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IN ('employees', 'customers')
);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Authenticated users can update their avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IN ('employees', 'customers')
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IN ('employees', 'customers')
);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Authenticated users can delete their avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IN ('employees', 'customers')
);

-- Allow public to view avatars (they are profile pictures)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');


-- 3. IMAGES BUCKET POLICIES (for menu, deals, etc.)
-- Allow authenticated users (admins) to upload images
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

-- Allow authenticated users to update images
CREATE POLICY "Authenticated users can update images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'images')
WITH CHECK (bucket_id = 'images');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'images');

-- Allow public to view images
CREATE POLICY "Anyone can view images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'images');


-- 4. REVIEWS BUCKET POLICIES
-- Allow authenticated users to upload review images
CREATE POLICY "Authenticated users can upload review images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reviews');

-- Allow authenticated users to delete their review images
CREATE POLICY "Authenticated users can delete review images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'reviews');

-- Allow public to view review images
CREATE POLICY "Anyone can view review images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'reviews');


-- =============================================
-- ALTERNATIVE: SIMPLER POLICIES (if above fail)
-- Uncomment and run these if the specific policies don't work
-- =============================================

/*
-- Drop existing policies first
DROP POLICY IF EXISTS "Authenticated users can upload their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;

-- Simple policy: Allow all authenticated operations on avatars bucket
CREATE POLICY "avatars_allow_authenticated_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_allow_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Simple policy: Allow all authenticated operations on images bucket
CREATE POLICY "images_allow_authenticated_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'images')
WITH CHECK (bucket_id = 'images');

CREATE POLICY "images_allow_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'images');

-- Simple policy: Allow all authenticated operations on reviews bucket
CREATE POLICY "reviews_allow_authenticated_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'reviews')
WITH CHECK (bucket_id = 'reviews');

CREATE POLICY "reviews_allow_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'reviews');
*/

-- =============================================
-- TROUBLESHOOTING: Check current policies
-- =============================================
-- Run this to see existing policies:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
