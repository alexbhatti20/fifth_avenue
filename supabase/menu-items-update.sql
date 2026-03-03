-- =====================================================
-- ZOIRO BROAST - MENU ITEMS UPDATE & OPTIMIZATION
-- Add piece_count column + Update images to webp format
-- Generated from official menu images
-- =====================================================

-- =====================================================
-- 1. ADD MISSING COLUMNS
-- =====================================================

-- Add piece_count column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'piece_count'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN piece_count INTEGER DEFAULT NULL;
    COMMENT ON COLUMN menu_items.piece_count IS 'Number of pieces in the item (e.g., 8pcs wings)';
  END IF;
END $$;

-- Add serves_count column for family meals
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'serves_count'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN serves_count INTEGER DEFAULT NULL;
    COMMENT ON COLUMN menu_items.serves_count IS 'Number of people this item serves';
  END IF;
END $$;

-- Add includes text column for combo descriptions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'includes'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN includes TEXT DEFAULT NULL;
    COMMENT ON COLUMN menu_items.includes IS 'What is included with this item (fries, bun, sauce, etc.)';
  END IF;
END $$;

-- =====================================================
-- 2. ENSURE CATEGORIES EXIST WITH PROPER DATA
-- =====================================================

INSERT INTO menu_categories (id, name, slug, description, image_url, display_order, is_visible)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Broast', 'broast', 'Signature Injected Broast - Saucy, Juicy, Crispy', 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800&q=80&fm=webp', 1, true),
  ('c1000000-0000-0000-0000-000000000002', 'Burgers', 'burgers', 'Delicious Chicken Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&fm=webp', 2, true),
  ('c1000000-0000-0000-0000-000000000003', 'Wraps', 'wraps', 'Wrap N Go - Fresh and Tasty', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80&fm=webp', 3, true),
  ('c1000000-0000-0000-0000-000000000004', 'Wings', 'wings', 'Lord of Wings - Crispy Chicken Wings', 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800&q=80&fm=webp', 4, true),
  ('c1000000-0000-0000-0000-000000000005', 'Shawarma', 'shawarma', 'Lebanese Style Shawarma', 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80&fm=webp', 5, true),
  ('c1000000-0000-0000-0000-000000000006', 'Appetizers', 'appetizers', 'Starters and Snacks', 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80&fm=webp', 6, true),
  ('c1000000-0000-0000-0000-000000000007', 'Nuggets', 'nuggets', 'Arabian Fillet Nuggets', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80', 7, true),
  ('c1000000-0000-0000-0000-000000000008', 'Sauces & Dips', 'sauces-dips', 'Delicious Dipping Sauces', 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800&q=80&fm=webp', 8, true),
  ('c1000000-0000-0000-0000-000000000009', 'Drinks', 'drinks', 'Refreshing Beverages', 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=800&q=80&fm=webp', 9, true),
  ('c1000000-0000-0000-0000-000000000010', 'Extras', 'extras', 'Extra Items and Add-ons', 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800&q=80&fm=webp', 10, true)
ON CONFLICT (id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  description = EXCLUDED.description;

-- =====================================================
-- 3. UPSERT ALL MENU ITEMS WITH ACCURATE DATA
-- (Uses ON CONFLICT to update existing or insert new)
-- =====================================================

-- BROAST ITEMS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count, serves_count, includes)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Full Broast',
    'full-broast',
    '8 pieces of signature injected broast: 2 Leg, 2 Chest, 2 Thigh, 2 Wings. Served with Fries, Bun, Arabian Sauce and Pickle.',
    2390,
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&q=80&fm=webp"]',
    true,
    true,
    25,
    '["bestseller", "family", "combo", "8pcs"]',
    8,
    4,
    'Fries, Bun, Arabian Sauce, Pickle'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000001',
    'Half Broast',
    'half-broast',
    '4 pieces of signature injected broast: 1 Leg, 1 Chest, 1 Thigh, 1 Wings. Served with Fries, Bun, Arabian Sauce and Pickle.',
    1390,
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&q=80&fm=webp"]',
    true,
    true,
    20,
    '["popular", "combo", "4pcs"]',
    4,
    2,
    'Fries, Bun, Arabian Sauce, Pickle'
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000001',
    'Quarter Broast',
    'quarter-broast',
    '2 pieces of signature injected broast: 1 Chest, 1 Wings. Served with Fries, Bun and Arabian Sauce.',
    690,
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800&q=80&fm=webp"]',
    true,
    false,
    15,
    '["single", "combo", "2pcs"]',
    2,
    1,
    'Fries, Bun, Arabian Sauce'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  serves_count = EXCLUDED.serves_count,
  includes = EXCLUDED.includes,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- BURGER ITEMS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count, includes)
VALUES
  (
    'a1000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000002',
    'Arabian Smoke Burger',
    'arabian-smoke-burger',
    'Smoky Arabian style chicken burger. Choose any two sauces: Arabian, Chipotle, Mild, Tangy, Cocktail, or Salsa sauce.',
    480,
    '["https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80&fm=webp"]',
    true,
    false,
    12,
    '["burger", "chicken", "smoky"]',
    1,
    'Choice of 2 sauces'
  ),
  (
    'a1000000-0000-0000-0000-000000000005',
    'c1000000-0000-0000-0000-000000000002',
    'Glazing Flame Burger',
    'glazing-flame-burger',
    'Flame-grilled chicken burger with special glaze. Choose any two sauces: Arabian, Chipotle, Mild, Tangy, Cocktail, or Salsa sauce.',
    480,
    '["https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80&fm=webp"]',
    true,
    false,
    12,
    '["burger", "chicken", "spicy", "flame-grilled"]',
    1,
    'Choice of 2 sauces'
  ),
  (
    'a1000000-0000-0000-0000-000000000006',
    'c1000000-0000-0000-0000-000000000002',
    'Zoro Signature Burger',
    'zoro-signature-burger',
    'Our signature burger with special ZOIRO recipe. Choose any two sauces: Arabian, Chipotle, Mild, Tangy, Cocktail, or Salsa sauce.',
    570,
    '["https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=800&q=80&fm=webp"]',
    true,
    true,
    15,
    '["burger", "chicken", "signature", "bestseller"]',
    1,
    'Choice of 2 sauces'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  includes = EXCLUDED.includes,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- WRAP ITEMS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count, includes)
VALUES
  (
    'a1000000-0000-0000-0000-000000000007',
    'c1000000-0000-0000-0000-000000000003',
    'Wrap N Go - Regular',
    'wrap-regular',
    'Fresh chicken wrap with your choice of two sauces. Add Jalapeno, Pickle, or Cheese Slice for Rs. 50 each.',
    490,
    '["https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1600803907087-f56d462fd26b?w=800&q=80&fm=webp"]',
    true,
    false,
    10,
    '["wrap", "chicken", "regular"]',
    1,
    'Choice of 2 sauces'
  ),
  (
    'a1000000-0000-0000-0000-000000000008',
    'c1000000-0000-0000-0000-000000000003',
    'Wrap N Go - Large',
    'wrap-large',
    'Large chicken wrap with extra filling and your choice of two sauces. Add Jalapeno, Pickle, or Cheese Slice for Rs. 50 each.',
    700,
    '["https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1600803907087-f56d462fd26b?w=800&q=80&fm=webp"]',
    true,
    true,
    12,
    '["wrap", "chicken", "large", "popular"]',
    1,
    'Choice of 2 sauces'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  includes = EXCLUDED.includes,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- WINGS ITEMS (Lord of Wings)
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count, serves_count)
VALUES
  (
    'a1000000-0000-0000-0000-000000000009',
    'c1000000-0000-0000-0000-000000000004',
    'Hot Wings',
    'hot-wings',
    '8 pieces of crispy hot wings with spicy coating.',
    550,
    '["https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&q=80&fm=webp"]',
    true,
    false,
    15,
    '["wings", "spicy", "8pcs", "hot"]',
    8,
    2
  ),
  (
    'a1000000-0000-0000-0000-000000000010',
    'c1000000-0000-0000-0000-000000000004',
    'Honey Lemon Wings',
    'honey-lemon-wings',
    '8 pieces of wings glazed with sweet honey lemon sauce.',
    590,
    '["https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1614398751058-eb2e0bf63e53?w=800&q=80&fm=webp"]',
    true,
    true,
    15,
    '["wings", "sweet", "8pcs", "honey", "bestseller"]',
    8,
    2
  ),
  (
    'a1000000-0000-0000-0000-000000000011',
    'c1000000-0000-0000-0000-000000000004',
    'Hot N Sour Wings',
    'hot-n-sour-wings',
    '8 pieces of wings with tangy hot and sour glaze.',
    590,
    '["https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=800&q=80&fm=webp"]',
    true,
    false,
    15,
    '["wings", "tangy", "8pcs", "hot-n-sour"]',
    8,
    2
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  serves_count = EXCLUDED.serves_count,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- SHAWARMA
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count, includes)
VALUES
  (
    'a1000000-0000-0000-0000-000000000012',
    'c1000000-0000-0000-0000-000000000005',
    'Lebanese Shawarma',
    'lebanese-shawarma',
    'Authentic Lebanese style chicken shawarma served with Pickle, Fries and Arabian Sauce.',
    600,
    '["https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1561651823-34feb02250e4?w=800&q=80&fm=webp"]',
    true,
    true,
    15,
    '["shawarma", "lebanese", "chicken", "popular"]',
    1,
    'Pickle, Fries, Arabian Sauce'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  includes = EXCLUDED.includes,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- APPETIZERS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count)
VALUES
  (
    'a1000000-0000-0000-0000-000000000013',
    'c1000000-0000-0000-0000-000000000006',
    'Arabian Chicken Donut',
    'arabian-chicken-donut',
    '4 pieces of delicious Arabian style chicken donuts.',
    350,
    '["https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80"]',
    true,
    false,
    12,
    '["appetizer", "4pcs", "chicken", "donuts"]',
    4
  ),
  (
    'a1000000-0000-0000-0000-000000000014',
    'c1000000-0000-0000-0000-000000000006',
    'Tender Strip',
    'tender-strip',
    '4 pieces of crispy chicken tender strips.',
    510,
    '["https://images.unsplash.com/photo-1562967915-92ae0c320a01?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1604909052743-94e838986d24?w=800&q=80&fm=webp"]',
    true,
    false,
    12,
    '["appetizer", "4pcs", "crispy", "tenders"]',
    4
  ),
  (
    'a1000000-0000-0000-0000-000000000015',
    'c1000000-0000-0000-0000-000000000006',
    'Mac N Cheese',
    'mac-n-cheese',
    'Creamy and cheesy macaroni pasta.',
    700,
    '["https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1612892483236-52d32a0e0ac1?w=800&q=80&fm=webp"]',
    true,
    false,
    15,
    '["appetizer", "pasta", "cheese", "creamy"]',
    NULL
  ),
  (
    'a1000000-0000-0000-0000-000000000016',
    'c1000000-0000-0000-0000-000000000006',
    'Loaded Fries',
    'loaded-fries',
    'Crispy fries loaded with cheese and special toppings.',
    500,
    '["https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80&fm=webp"]',
    true,
    true,
    12,
    '["appetizer", "fries", "cheese", "loaded", "popular"]',
    NULL
  ),
  (
    'a1000000-0000-0000-0000-000000000017',
    'c1000000-0000-0000-0000-000000000006',
    'Fries',
    'fries',
    'Crispy golden french fries.',
    230,
    '["https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1629385701021-fcd568a743f7?w=800&q=80&fm=webp"]',
    true,
    false,
    8,
    '["appetizer", "fries", "sides", "classic"]',
    NULL
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- NUGGETS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count)
VALUES
  (
    'a1000000-0000-0000-0000-000000000018',
    'c1000000-0000-0000-0000-000000000007',
    'Arabian Fillet Nuggets',
    'arabian-fillet-nuggets',
    '5 pieces of premium Arabian style chicken fillet nuggets.',
    490,
    '["https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80", "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80&fm=webp"]',
    true,
    true,
    12,
    '["nuggets", "5pcs", "chicken", "arabian", "bestseller"]',
    5
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- SAUCES & DIPS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count)
VALUES
  (
    'a1000000-0000-0000-0000-000000000019',
    'c1000000-0000-0000-0000-000000000008',
    'Arabian Sauce',
    'arabian-sauce',
    'Signature Arabian dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["sauce", "dip", "arabian"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000020',
    'c1000000-0000-0000-0000-000000000008',
    'Chipotle Sauce',
    'chipotle-sauce',
    'Smoky chipotle dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["sauce", "dip", "spicy", "chipotle"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000021',
    'c1000000-0000-0000-0000-000000000008',
    'Mild Sauce',
    'mild-sauce',
    'Mild and creamy dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["sauce", "dip", "mild", "creamy"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000022',
    'c1000000-0000-0000-0000-000000000008',
    'Tangy Sauce',
    'tangy-sauce',
    'Tangy dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["sauce", "dip", "tangy"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000023',
    'c1000000-0000-0000-0000-000000000008',
    'Cocktail Sauce',
    'cocktail-sauce',
    'Classic cocktail dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["sauce", "dip", "cocktail"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000024',
    'c1000000-0000-0000-0000-000000000008',
    'Salsa Sauce',
    'salsa-sauce',
    'Fresh salsa dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["sauce", "dip", "salsa"]',
    1
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- DRINKS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count)
VALUES
  (
    'a1000000-0000-0000-0000-000000000025',
    'c1000000-0000-0000-0000-000000000009',
    'Water 1.5L',
    'water-1500ml',
    '1.5 Liter mineral water bottle.',
    80,
    '["https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["drink", "water", "1.5L"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000026',
    'c1000000-0000-0000-0000-000000000009',
    'Water 500ml',
    'water-500ml',
    '500ml mineral water bottle.',
    60,
    '["https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["drink", "water", "500ml"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000027',
    'c1000000-0000-0000-0000-000000000009',
    'Cold Drink 500ml',
    'cold-drink-500ml',
    '500ml cold drink (Pepsi/Coca-Cola/7Up/Mirinda).',
    130,
    '["https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=800&q=80&fm=webp", "https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["drink", "soft drink", "500ml", "cold"]',
    1
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- EXTRAS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags, piece_count)
VALUES
  (
    'a1000000-0000-0000-0000-000000000028',
    'c1000000-0000-0000-0000-000000000010',
    'Extra Broast Piece',
    'extra-broast-piece',
    'Single piece of Leg/Chest/Thigh broast.',
    380,
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800&q=80&fm=webp"]',
    true,
    false,
    10,
    '["extra", "broast", "leg", "chest", "thigh"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000029',
    'c1000000-0000-0000-0000-000000000010',
    'Extra Bun',
    'extra-bun',
    'Fresh soft bun.',
    50,
    '["https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["extra", "bread", "bun"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000030',
    'c1000000-0000-0000-0000-000000000010',
    'Jalapeno',
    'jalapeno',
    'Extra jalapeno peppers.',
    50,
    '["https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["extra", "topping", "spicy", "jalapeno"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000031',
    'c1000000-0000-0000-0000-000000000010',
    'Pickle',
    'pickle',
    'Extra pickle.',
    50,
    '["https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["extra", "topping", "pickle"]',
    1
  ),
  (
    'a1000000-0000-0000-0000-000000000032',
    'c1000000-0000-0000-0000-000000000010',
    'Cheese Slice',
    'cheese-slice',
    'Extra cheese slice.',
    50,
    '["https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&q=80&fm=webp"]',
    true,
    false,
    1,
    '["extra", "topping", "cheese"]',
    1
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  images = EXCLUDED.images,
  tags = EXCLUDED.tags,
  piece_count = EXCLUDED.piece_count,
  is_available = EXCLUDED.is_available,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- =====================================================
-- 4. UPDATE RPC FUNCTIONS TO INCLUDE NEW COLUMNS
-- =====================================================

-- Update get_menu_data RPC to include new columns
CREATE OR REPLACE FUNCTION get_menu_data()
RETURNS TABLE (
  categories JSON,
  items JSON,
  deals JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'description', c.description,
          'image_url', c.image_url,
          'display_order', c.display_order,
          'is_visible', c.is_visible
        ) ORDER BY c.display_order
      ), '[]'::json)
      FROM menu_categories c
      WHERE c.is_visible = true
    ) AS categories,
    (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', m.id,
          'category_id', m.category_id,
          'name', m.name,
          'slug', m.slug,
          'description', m.description,
          'price', m.price,
          'images', m.images,
          'is_available', m.is_available,
          'is_featured', m.is_featured,
          'preparation_time', m.preparation_time,
          'rating', COALESCE(m.rating, 0),
          'total_reviews', COALESCE(m.total_reviews, 0),
          'tags', m.tags,
          'nutritional_info', m.nutritional_info,
          'size_variants', m.size_variants,
          'has_variants', COALESCE(m.has_variants, false),
          'piece_count', m.piece_count,
          'serves_count', m.serves_count,
          'includes', m.includes
        ) ORDER BY m.is_featured DESC, m.name
      ), '[]'::json)
      FROM menu_items m
      WHERE m.is_available = true
    ) AS items,
    (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', d.id,
          'name', d.name,
          'slug', d.slug,
          'description', d.description,
          'deal_type', d.deal_type,
          'original_price', d.original_price,
          'discounted_price', d.discounted_price,
          'image_url', d.image_url,
          'images', d.images,
          'is_active', d.is_active,
          'is_featured', d.is_featured,
          'valid_from', d.valid_from,
          'valid_until', d.valid_until
        ) ORDER BY d.is_featured DESC, d.name
      ), '[]'::json)
      FROM deals d
      WHERE d.is_active = true
        AND d.valid_from <= NOW()
        AND d.valid_until >= NOW()
    ) AS deals;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_menu_data TO anon, authenticated;

-- =====================================================
-- 5. VERIFICATION QUERIES
-- =====================================================

-- Verify all items have piece_count where applicable
-- SELECT name, price, piece_count, tags FROM menu_items ORDER BY category_id, name;

-- Verify categories
-- SELECT name, display_order, is_visible FROM menu_categories ORDER BY display_order;

-- Verify total item count
-- SELECT COUNT(*) as total_items FROM menu_items;

-- =====================================================
-- FIX BROKEN UNSPLASH IMAGE URLs (404s)
-- These photo IDs return 404 and must be replaced
-- =====================================================

-- Fix Nuggets category (photo-1585325701165-351af660e4ee → 404)
UPDATE menu_categories
SET image_url = 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80'
WHERE image_url LIKE '%photo-1585325701165-351af660e4ee%';

-- Fix Extras category (photo-1630384060421-cb20aed28116 → 404)
UPDATE menu_categories
SET image_url = 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800&q=80&fm=webp'
WHERE image_url LIKE '%photo-1630384060421-cb20aed28116%';

-- Fix any menu_items still referencing the broken nuggets photo
UPDATE menu_items
SET images = REPLACE(images::text, 'photo-1585325701165-351af660e4ee', 'photo-1626082927389-6cd097cdc6ec')::jsonb
WHERE images::text LIKE '%photo-1585325701165-351af660e4ee%';

-- Fix any menu_items still referencing the previously broken replacement
UPDATE menu_items
SET images = REPLACE(images::text, 'photo-1619881589670-43629f0e90f4', 'photo-1626082927389-6cd097cdc6ec')::jsonb
WHERE images::text LIKE '%photo-1619881589670-43629f0e90f4%';

-- Fix any menu_categories still having the previously broken replacement
UPDATE menu_categories
SET image_url = REPLACE(image_url, 'photo-1619881589670-43629f0e90f4', 'photo-1626082927389-6cd097cdc6ec')
WHERE image_url LIKE '%photo-1619881589670-43629f0e90f4%';

-- Fix any menu_items still referencing the broken extras photo
UPDATE menu_items
SET images = REPLACE(images::text, 'photo-1630384060421-cb20aed28116', 'photo-1585109649139-366815a0d713')::jsonb
WHERE images::text LIKE '%photo-1630384060421-cb20aed28116%';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
