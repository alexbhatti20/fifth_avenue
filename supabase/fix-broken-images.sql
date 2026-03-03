-- =====================================================
-- FIX BROKEN UNSPLASH IMAGE URLS
-- Run this in Supabase SQL Editor to fix 404 images
-- =====================================================

-- photo-1585325701165-351af660e4ee  (original nuggets)  → 404
-- photo-1619881589670-43629f0e90f4  (first replacement) → ALSO 404 (deleted from Unsplash)
-- photo-1630384060421-cb20aed28116  (original extras)   → 404
-- Replacement: photo-1626082927389-6cd097cdc6ec (verified working)

-- Update Nuggets category image
UPDATE menu_categories 
SET image_url = 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80'
WHERE slug = 'nuggets' OR name ILIKE '%nugget%';

-- Update Extras category image (photo-1630384060421-cb20aed28116 was 404)
UPDATE menu_categories 
SET image_url = 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800&q=80'
WHERE slug = 'extras' OR name ILIKE '%extra%';

-- Fix menu_items: original broken nuggets photo
UPDATE menu_items 
SET images = REPLACE(images::text, 'photo-1585325701165-351af660e4ee', 'photo-1626082927389-6cd097cdc6ec')::jsonb
WHERE images::text LIKE '%photo-1585325701165-351af660e4ee%';

-- Fix menu_items: the previously applied (but also broken) nuggets replacement
UPDATE menu_items 
SET images = REPLACE(images::text, 'photo-1619881589670-43629f0e90f4', 'photo-1626082927389-6cd097cdc6ec')::jsonb
WHERE images::text LIKE '%photo-1619881589670-43629f0e90f4%';

-- Fix menu_categories that still have the broken nuggets replacement
UPDATE menu_categories
SET image_url = REPLACE(image_url, 'photo-1619881589670-43629f0e90f4', 'photo-1626082927389-6cd097cdc6ec')
WHERE image_url LIKE '%photo-1619881589670-43629f0e90f4%';

-- Fix menu_items: original broken extras/loaded-fries photo
UPDATE menu_items 
SET images = REPLACE(images::text, 'photo-1630384060421-cb20aed28116', 'photo-1585109649139-366815a0d713')::jsonb
WHERE images::text LIKE '%photo-1630384060421-cb20aed28116%';

-- Verify the fix
SELECT name, image_url FROM menu_categories WHERE slug IN ('nuggets', 'extras');
SELECT name, images FROM menu_items WHERE name ILIKE '%nugget%' OR name ILIKE '%loaded%';
