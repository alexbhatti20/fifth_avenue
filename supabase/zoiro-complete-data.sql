-- =====================================================
-- ZOIRO BROAST - COMPLETE DATA SEED SCRIPT
-- Generated from official menu images
-- =====================================================

-- =====================================================
-- 1. BRAND INFORMATION & WEBSITE CONTENT
-- =====================================================

-- Delete existing website content to avoid duplicates
DELETE FROM website_content WHERE key IN (
  'brand_info', 'contact_info', 'about_us', 'terms_conditions', 
  'privacy_policy', 'delivery_policy', 'refund_policy', 'faq'
);

-- Brand Information
INSERT INTO website_content (key, title, content, section, is_active)
VALUES (
  'brand_info',
  'ZOIRO Broast',
  '{
    "name": "ZOIRO Broast",
    "tagline": "Injected Broast - Saucy. Juicy. Crispy.",
    "slogan": "First Time in Vehari - Injected Broast",
    "established": "2024",
    "logo_url": "/assets/zoiro-logo.png",
    "description": "ZOIRO Broast brings you the most delicious, crispy, and juicy broasted chicken in Vehari. Our signature injected broast technique ensures every bite is packed with flavor.",
    "features": [
      "Saucy",
      "Juicy", 
      "Crispy"
    ],
    "social_media": {
      "facebook": "https://facebook.com/zoirobroast",
      "instagram": "https://instagram.com/zoirobroast",
      "whatsapp": "+923046292822"
    }
  }',
  'brand',
  true
);

-- Contact Information
INSERT INTO website_content (key, title, content, section, is_active)
VALUES (
  'contact_info',
  'Contact Us',
  '{
    "email": "zorobroast@gmail.com",
    "phone": "+92 304 629 2822",
    "whatsapp": "+92 304 629 2822",
    "address": "Near Baba G Kulfi, Faisal Town, Vehari",
    "city": "Vehari",
    "province": "Punjab",
    "country": "Pakistan",
    "postal_code": "61100",
    "opening_hours": {
      "monday": "11:00 AM - 11:00 PM",
      "tuesday": "11:00 AM - 11:00 PM",
      "wednesday": "11:00 AM - 11:00 PM",
      "thursday": "11:00 AM - 11:00 PM",
      "friday": "11:00 AM - 11:00 PM",
      "saturday": "11:00 AM - 11:00 PM",
      "sunday": "11:00 AM - 11:00 PM"
    },
    "delivery": {
      "available": true,
      "free_delivery": true,
      "minimum_order": 500,
      "delivery_time": "30-45 minutes",
      "delivery_area": "Vehari City"
    },
    "google_maps_url": "https://maps.google.com/?q=Faisal+Town+Vehari"
  }',
  'contact',
  true
);

-- About Us
INSERT INTO website_content (key, title, content, section, is_active)
VALUES (
  'about_us',
  'About ZOIRO Broast',
  '{
    "title": "About ZOIRO Broast",
    "subtitle": "First Time in Vehari - Injected Broast",
    "story": "ZOIRO Broast was founded with a passion for bringing the authentic taste of perfectly broasted chicken to Vehari. Our unique injection technique ensures that every piece of chicken is marinated from the inside out, delivering unmatched flavor and juiciness.",
    "mission": "To serve the most delicious, high-quality broasted chicken while providing exceptional customer service and creating memorable dining experiences.",
    "vision": "To become the leading broast restaurant chain in Pakistan, known for our signature Injected Broast and commitment to quality.",
    "values": [
      {
        "title": "Quality",
        "description": "We use only the freshest ingredients and premium chicken"
      },
      {
        "title": "Taste",
        "description": "Our secret recipes and techniques ensure unforgettable flavors"
      },
      {
        "title": "Service",
        "description": "Fast, friendly, and reliable service every time"
      },
      {
        "title": "Hygiene",
        "description": "Maintaining the highest standards of cleanliness and food safety"
      }
    ],
    "highlights": [
      "Premium Quality Chicken",
      "Signature Injected Broast Technique",
      "Fresh Ingredients Daily",
      "Free Home Delivery",
      "Family-Friendly Environment"
    ]
  }',
  'about',
  true
);

-- Terms and Conditions
INSERT INTO website_content (key, title, content, section, is_active)
VALUES (
  'terms_conditions',
  'Terms and Conditions',
  '{
    "title": "Terms and Conditions",
    "last_updated": "2024-01-01",
    "sections": [
      {
        "title": "1. Acceptance of Terms",
        "content": "By accessing and using the ZOIRO Broast website and services, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our services."
      },
      {
        "title": "2. Services",
        "content": "ZOIRO Broast provides online food ordering and delivery services within Vehari city. We reserve the right to modify, suspend, or discontinue any service at any time without prior notice."
      },
      {
        "title": "3. User Accounts",
        "content": "To place orders, you may need to create an account. You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate and complete information during registration."
      },
      {
        "title": "4. Orders and Payments",
        "content": "All orders are subject to availability and confirmation. Prices displayed are in Pakistani Rupees (PKR) and include applicable taxes. Payment methods accepted include Cash on Delivery (COD), Bank Transfer, and EasyPaisa/JazzCash."
      },
      {
        "title": "5. Delivery",
        "content": "We aim to deliver orders within 30-45 minutes within our delivery area. Delivery times may vary due to weather conditions, traffic, or high order volumes. Free delivery is available for orders above Rs. 500."
      },
      {
        "title": "6. Cancellations and Refunds",
        "content": "Orders can be cancelled within 5 minutes of placement. After food preparation begins, cancellations may not be possible. Refunds for quality issues will be processed within 3-5 business days."
      },
      {
        "title": "7. Quality Assurance",
        "content": "We are committed to providing fresh, high-quality food. If you receive an order that does not meet our quality standards, please contact us immediately for a replacement or refund."
      },
      {
        "title": "8. Liability",
        "content": "ZOIRO Broast is not liable for any indirect, incidental, or consequential damages arising from the use of our services. Our total liability shall not exceed the value of your order."
      },
      {
        "title": "9. Intellectual Property",
        "content": "All content on this website, including logos, images, and text, is the property of ZOIRO Broast and protected by copyright laws. Unauthorized use is prohibited."
      },
      {
        "title": "10. Changes to Terms",
        "content": "We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the new terms."
      }
    ],
    "contact_for_queries": "For any questions regarding these terms, please contact us at zorobroast@gmail.com"
  }',
  'legal',
  true
);

-- Privacy Policy
INSERT INTO website_content (key, title, content, section, is_active)
VALUES (
  'privacy_policy',
  'Privacy Policy',
  '{
    "title": "Privacy Policy",
    "last_updated": "2024-01-01",
    "sections": [
      {
        "title": "1. Information We Collect",
        "content": "We collect personal information that you provide when creating an account, placing orders, or contacting us. This includes: Name, Email address, Phone number, Delivery address, and Payment information."
      },
      {
        "title": "2. How We Use Your Information",
        "content": "We use your information to: Process and deliver your orders, Send order confirmations and updates, Improve our services, Send promotional offers (with your consent), Provide customer support, and Comply with legal obligations."
      },
      {
        "title": "3. Information Sharing",
        "content": "We do not sell or rent your personal information to third parties. We may share information with: Delivery personnel (name, address, phone for delivery), Payment processors for secure transactions, and Law enforcement when required by law."
      },
      {
        "title": "4. Data Security",
        "content": "We implement appropriate security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure servers, and regular security audits."
      },
      {
        "title": "5. Cookies",
        "content": "Our website uses cookies to enhance your browsing experience, remember your preferences, and analyze website traffic. You can disable cookies in your browser settings, but some features may not work properly."
      },
      {
        "title": "6. Your Rights",
        "content": "You have the right to: Access your personal information, Request correction of inaccurate data, Request deletion of your data, Opt-out of marketing communications, and Withdraw consent at any time."
      },
      {
        "title": "7. Data Retention",
        "content": "We retain your personal information for as long as your account is active or as needed to provide services. Order history is retained for record-keeping purposes and legal compliance."
      },
      {
        "title": "8. Children Privacy",
        "content": "Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children."
      },
      {
        "title": "9. Changes to Privacy Policy",
        "content": "We may update this privacy policy periodically. We will notify you of significant changes via email or website notification."
      },
      {
        "title": "10. Contact Us",
        "content": "For privacy-related inquiries, please contact us at: Email: zorobroast@gmail.com, Phone: +92 304 629 2822, Address: Near Baba G Kulfi, Faisal Town, Vehari"
      }
    ]
  }',
  'legal',
  true
);

-- Delivery Policy
INSERT INTO website_content (key, title, content, section, is_active)
VALUES (
  'delivery_policy',
  'Delivery Policy',
  '{
    "title": "Delivery Policy",
    "last_updated": "2024-01-01",
    "delivery_area": "Vehari City",
    "delivery_time": "30-45 minutes",
    "free_delivery_minimum": 500,
    "delivery_fee": 0,
    "sections": [
      {
        "title": "Delivery Hours",
        "content": "We deliver from 11:00 AM to 11:00 PM, seven days a week."
      },
      {
        "title": "Delivery Area",
        "content": "We currently deliver within Vehari city limits. Enter your address during checkout to confirm delivery availability."
      },
      {
        "title": "Free Delivery",
        "content": "Enjoy FREE home delivery on all orders above Rs. 500. Orders below Rs. 500 may have a nominal delivery charge."
      },
      {
        "title": "Delivery Time",
        "content": "Standard delivery time is 30-45 minutes. During peak hours or adverse weather, delivery may take longer. We will notify you of any delays."
      },
      {
        "title": "Order Tracking",
        "content": "Once your order is confirmed, you can track its status in real-time through our website or WhatsApp updates."
      },
      {
        "title": "Delivery Instructions",
        "content": "Please provide accurate address details and a working phone number. Our rider will contact you upon arrival."
      }
    ]
  }',
  'policy',
  true
);

-- Refund Policy
INSERT INTO website_content (key, title, content, section, is_active)
VALUES (
  'refund_policy',
  'Refund Policy',
  '{
    "title": "Refund & Return Policy",
    "last_updated": "2024-01-01",
    "sections": [
      {
        "title": "Quality Guarantee",
        "content": "We take pride in our food quality. If you receive an order that does not meet our standards, we will make it right."
      },
      {
        "title": "Eligible Refunds",
        "content": "Refunds are provided for: Wrong items delivered, Missing items from order, Quality issues (undercooked, stale, etc.), and Order not delivered."
      },
      {
        "title": "How to Request Refund",
        "content": "Contact us within 30 minutes of receiving your order with photos of the issue. Call +92 304 629 2822 or WhatsApp us with your order number and concern."
      },
      {
        "title": "Refund Process",
        "content": "After verification, refunds will be processed within 3-5 business days to your original payment method. For COD orders, store credit or replacement will be offered."
      },
      {
        "title": "Non-Refundable Cases",
        "content": "Refunds are not provided for: Change of mind after delivery, Incorrect address provided by customer, and Orders that have been consumed."
      }
    ]
  }',
  'policy',
  true
);

-- FAQ
INSERT INTO website_content (key, title, content, section, is_active)
VALUES (
  'faq',
  'Frequently Asked Questions',
  '{
    "title": "Frequently Asked Questions",
    "questions": [
      {
        "question": "What is Injected Broast?",
        "answer": "Injected Broast is our signature technique where chicken is marinated by injecting flavorful spices directly into the meat, ensuring every bite is juicy and flavorful from the inside out."
      },
      {
        "question": "What are your delivery hours?",
        "answer": "We deliver from 11:00 AM to 11:00 PM, seven days a week."
      },
      {
        "question": "Is delivery free?",
        "answer": "Yes! Delivery is FREE for all orders above Rs. 500 within Vehari city."
      },
      {
        "question": "How long does delivery take?",
        "answer": "Standard delivery time is 30-45 minutes. During peak hours, it may take slightly longer."
      },
      {
        "question": "What payment methods do you accept?",
        "answer": "We accept Cash on Delivery (COD), Bank Transfer, EasyPaisa, and JazzCash."
      },
      {
        "question": "Can I customize my order?",
        "answer": "Yes! You can add special instructions to your order. For specific customizations, please mention in the notes section."
      },
      {
        "question": "Do you offer halal food?",
        "answer": "Absolutely! All our food is 100% Halal certified."
      },
      {
        "question": "How can I contact customer support?",
        "answer": "You can reach us at +92 304 629 2822 (Call/WhatsApp) or email zorobroast@gmail.com"
      }
    ]
  }',
  'support',
  true
);

-- =====================================================
-- 2. MENU CATEGORIES
-- =====================================================

-- Delete existing categories to avoid duplicates
DELETE FROM menu_categories;

INSERT INTO menu_categories (id, name, slug, description, image_url, display_order, is_visible)
VALUES
  -- Main Categories
  ('c1000000-0000-0000-0000-000000000001', 'Broast', 'broast', 'Signature Injected Broast - Saucy, Juicy, Crispy', 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800', 1, true),
  ('c1000000-0000-0000-0000-000000000002', 'Burgers', 'burgers', 'Delicious Chicken Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800', 2, true),
  ('c1000000-0000-0000-0000-000000000003', 'Wraps', 'wraps', 'Wrap N Go - Fresh and Tasty', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800', 3, true),
  ('c1000000-0000-0000-0000-000000000004', 'Wings', 'wings', 'Lord of Wings - Crispy Chicken Wings', 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800', 4, true),
  ('c1000000-0000-0000-0000-000000000005', 'Shawarma', 'shawarma', 'Lebanese Style Shawarma', 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800', 5, true),
  ('c1000000-0000-0000-0000-000000000006', 'Appetizers', 'appetizers', 'Starters and Snacks', 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800', 6, true),
  ('c1000000-0000-0000-0000-000000000007', 'Nuggets', 'nuggets', 'Arabian Fillet Nuggets', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80', 7, true),
  ('c1000000-0000-0000-0000-000000000008', 'Sauces & Dips', 'sauces-dips', 'Delicious Dipping Sauces', 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800', 8, true),
  ('c1000000-0000-0000-0000-000000000009', 'Drinks', 'drinks', 'Refreshing Beverages', 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=800', 9, true),
  ('c1000000-0000-0000-0000-000000000010', 'Extras', 'extras', 'Extra Items and Add-ons', 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800&q=80&fm=webp', 10, true);

-- =====================================================
-- 3. MENU ITEMS
-- =====================================================

-- Delete existing menu items to avoid duplicates
DELETE FROM menu_items;

-- BROAST ITEMS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  -- Full Broast (8 PCS)
  (
    'a1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Full Broast',
    'full-broast',
    '8 pieces of signature injected broast: 2 Leg, 2 Chest, 2 Thigh, 2 Wings. Served with Fries, Bun, Arabian Sauce and Pickle.',
    2390,
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800", "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800"]',
    true,
    true,
    25,
    '["bestseller", "family", "combo", "8pcs"]'
  ),
  
  -- Half Broast (4 PCS)
  (
    'a1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000001',
    'Half Broast',
    'half-broast',
    '4 pieces of signature injected broast: 1 Leg, 1 Chest, 1 Thigh, 1 Wings. Served with Fries, Bun, Arabian Sauce and Pickle.',
    1390,
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800"]',
    true,
    true,
    20,
    '["popular", "combo", "4pcs"]'
  ),
  
  -- Quarter Broast (2 PCS)
  (
    'a1000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000001',
    'Quarter Broast',
    'quarter-broast',
    '2 pieces of signature injected broast: 1 Chest, 1 Wings. Served with Fries, Bun and Arabian Sauce.',
    690,
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800"]',
    true,
    false,
    15,
    '["single", "combo", "2pcs"]'
  );

-- BURGER ITEMS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  -- Arabian Smoke Burger
  (
    'a1000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000002',
    'Arabian Smoke Burger',
    'arabian-smoke-burger',
    'Smoky Arabian style chicken burger. Choose any two sauces: Arabian, Chipotle, Mild, Tangy, Cocktail, or Salsa sauce.',
    480,
    '["https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800"]',
    true,
    false,
    12,
    '["burger", "chicken"]'
  ),
  
  -- Glazing Flame Burger
  (
    'a1000000-0000-0000-0000-000000000005',
    'c1000000-0000-0000-0000-000000000002',
    'Glazing Flame Burger',
    'glazing-flame-burger',
    'Flame-grilled chicken burger with special glaze. Choose any two sauces: Arabian, Chipotle, Mild, Tangy, Cocktail, or Salsa sauce.',
    480,
    '["https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800"]',
    true,
    false,
    12,
    '["burger", "chicken", "spicy"]'
  ),
  
  -- Zoro Signature Burger
  (
    'a1000000-0000-0000-0000-000000000006',
    'c1000000-0000-0000-0000-000000000002',
    'Zoro Signature Burger',
    'zoro-signature-burger',
    'Our signature burger with special ZOIRO recipe. Choose any two sauces: Arabian, Chipotle, Mild, Tangy, Cocktail, or Salsa sauce.',
    570,
    '["https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800"]',
    true,
    true,
    15,
    '["burger", "chicken", "signature", "bestseller"]'
  );

-- WRAP ITEMS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  -- Regular Wrap
  (
    'a1000000-0000-0000-0000-000000000007',
    'c1000000-0000-0000-0000-000000000003',
    'Wrap N Go - Regular',
    'wrap-regular',
    'Fresh chicken wrap with your choice of two sauces. Add Jalapeno, Pickle, or Cheese Slice for Rs. 50 each.',
    490,
    '["https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800"]',
    true,
    false,
    10,
    '["wrap", "chicken"]'
  ),
  
  -- Large Wrap
  (
    'a1000000-0000-0000-0000-000000000008',
    'c1000000-0000-0000-0000-000000000003',
    'Wrap N Go - Large',
    'wrap-large',
    'Large chicken wrap with extra filling and your choice of two sauces. Add Jalapeno, Pickle, or Cheese Slice for Rs. 50 each.',
    700,
    '["https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800"]',
    true,
    true,
    12,
    '["wrap", "chicken", "large"]'
  );

-- WINGS ITEMS (Lord of Wings)
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  -- Hot Wings
  (
    'a1000000-0000-0000-0000-000000000009',
    'c1000000-0000-0000-0000-000000000004',
    'Hot Wings',
    'hot-wings',
    '8 pieces of crispy hot wings with spicy coating.',
    550,
    '["https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800"]',
    true,
    false,
    15,
    '["wings", "spicy", "8pcs"]'
  ),
  
  -- Honey Lemon Wings
  (
    'a1000000-0000-0000-0000-000000000010',
    'c1000000-0000-0000-0000-000000000004',
    'Honey Lemon Wings',
    'honey-lemon-wings',
    '8 pieces of wings glazed with sweet honey lemon sauce.',
    590,
    '["https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=800"]',
    true,
    true,
    15,
    '["wings", "sweet", "8pcs"]'
  ),
  
  -- Hot N Sour Wings
  (
    'a1000000-0000-0000-0000-000000000011',
    'c1000000-0000-0000-0000-000000000004',
    'Hot N Sour Wings',
    'hot-n-sour-wings',
    '8 pieces of wings with tangy hot and sour glaze.',
    590,
    '["https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800"]',
    true,
    false,
    15,
    '["wings", "tangy", "8pcs"]'
  );

-- SHAWARMA
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  (
    'a1000000-0000-0000-0000-000000000012',
    'c1000000-0000-0000-0000-000000000005',
    'Lebanese Shawarma',
    'lebanese-shawarma',
    'Authentic Lebanese style chicken shawarma served with Pickle, Fries and Arabian Sauce.',
    600,
    '["https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800"]',
    true,
    true,
    15,
    '["shawarma", "lebanese", "chicken"]'
  );

-- APPETIZERS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  -- Arabian Chicken Donut
  (
    'a1000000-0000-0000-0000-000000000013',
    'c1000000-0000-0000-0000-000000000006',
    'Arabian Chicken Donut',
    'arabian-chicken-donut',
    '4 pieces of delicious Arabian style chicken donuts.',
    350,
    '["https://images.unsplash.com/photo-1562967914-608f82629710?w=800"]',
    true,
    false,
    12,
    '["appetizer", "4pcs"]'
  ),
  
  -- Tender Strip
  (
    'a1000000-0000-0000-0000-000000000014',
    'c1000000-0000-0000-0000-000000000006',
    'Tender Strip',
    'tender-strip',
    '4 pieces of crispy chicken tender strips.',
    510,
    '["https://images.unsplash.com/photo-1562967915-92ae0c320a01?w=800"]',
    true,
    false,
    12,
    '["appetizer", "4pcs", "crispy"]'
  ),
  
  -- Mac N Cheese
  (
    'a1000000-0000-0000-0000-000000000015',
    'c1000000-0000-0000-0000-000000000006',
    'Mac N Cheese',
    'mac-n-cheese',
    'Creamy and cheesy macaroni pasta.',
    700,
    '["https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=800"]',
    true,
    false,
    15,
    '["appetizer", "pasta", "cheese"]'
  ),
  
  -- Loaded Fries
  (
    'a1000000-0000-0000-0000-000000000016',
    'c1000000-0000-0000-0000-000000000006',
    'Loaded Fries',
    'loaded-fries',
    'Crispy fries loaded with cheese and special toppings.',
    500,
    '["https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800&q=80&fm=webp"]',
    true,
    true,
    12,
    '["appetizer", "fries", "cheese"]'
  ),
  
  -- Regular Fries
  (
    'a1000000-0000-0000-0000-000000000017',
    'c1000000-0000-0000-0000-000000000006',
    'Fries',
    'fries',
    'Crispy golden french fries.',
    230,
    '["https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800"]',
    true,
    false,
    8,
    '["appetizer", "fries", "sides"]'
  );

-- NUGGETS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  (
    'a1000000-0000-0000-0000-000000000018',
    'c1000000-0000-0000-0000-000000000007',
    'Arabian Fillet Nuggets',
    'arabian-fillet-nuggets',
    '5 pieces of premium Arabian style chicken fillet nuggets.',
    490,
    '["https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&q=80"]',
    true,
    true,
    12,
    '["nuggets", "5pcs", "chicken"]'
  );

-- SAUCES & DIPS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  (
    'a1000000-0000-0000-0000-000000000019',
    'c1000000-0000-0000-0000-000000000008',
    'Arabian Sauce',
    'arabian-sauce',
    'Signature Arabian dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800"]',
    true,
    false,
    1,
    '["sauce", "dip"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000020',
    'c1000000-0000-0000-0000-000000000008',
    'Chipotle Sauce',
    'chipotle-sauce',
    'Smoky chipotle dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800"]',
    true,
    false,
    1,
    '["sauce", "dip", "spicy"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000021',
    'c1000000-0000-0000-0000-000000000008',
    'Mild Sauce',
    'mild-sauce',
    'Mild and creamy dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800"]',
    true,
    false,
    1,
    '["sauce", "dip"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000022',
    'c1000000-0000-0000-0000-000000000008',
    'Tangy Sauce',
    'tangy-sauce',
    'Tangy dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800"]',
    true,
    false,
    1,
    '["sauce", "dip", "tangy"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000023',
    'c1000000-0000-0000-0000-000000000008',
    'Cocktail Sauce',
    'cocktail-sauce',
    'Classic cocktail dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800"]',
    true,
    false,
    1,
    '["sauce", "dip"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000024',
    'c1000000-0000-0000-0000-000000000008',
    'Salsa Sauce',
    'salsa-sauce',
    'Fresh salsa dipping sauce.',
    50,
    '["https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800"]',
    true,
    false,
    1,
    '["sauce", "dip"]'
  );

-- DRINKS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  (
    'a1000000-0000-0000-0000-000000000025',
    'c1000000-0000-0000-0000-000000000009',
    'Water 1.5L',
    'water-1500ml',
    '1.5 Liter mineral water bottle.',
    80,
    '["https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800"]',
    true,
    false,
    1,
    '["drink", "water"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000026',
    'c1000000-0000-0000-0000-000000000009',
    'Water 500ml',
    'water-500ml',
    '500ml mineral water bottle.',
    60,
    '["https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800"]',
    true,
    false,
    1,
    '["drink", "water"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000027',
    'c1000000-0000-0000-0000-000000000009',
    'Cold Drink 500ml',
    'cold-drink-500ml',
    '500ml cold drink (Pepsi/Coca-Cola/7Up/Mirinda).',
    130,
    '["https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=800"]',
    true,
    false,
    1,
    '["drink", "soft drink"]'
  );

-- EXTRAS
INSERT INTO menu_items (id, category_id, name, slug, description, price, images, is_available, is_featured, preparation_time, tags)
VALUES
  (
    'a1000000-0000-0000-0000-000000000028',
    'c1000000-0000-0000-0000-000000000010',
    'Extra Broast Piece',
    'extra-broast-piece',
    'Single piece of Leg/Chest/Thigh broast.',
    380,
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800"]',
    true,
    false,
    10,
    '["extra", "broast"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000029',
    'c1000000-0000-0000-0000-000000000010',
    'Extra Bun',
    'extra-bun',
    'Fresh soft bun.',
    50,
    '["https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=800"]',
    true,
    false,
    1,
    '["extra", "bread"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000030',
    'c1000000-0000-0000-0000-000000000010',
    'Jalapeno',
    'jalapeno',
    'Extra jalapeno peppers.',
    50,
    '["https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=800"]',
    true,
    false,
    1,
    '["extra", "topping", "spicy"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000031',
    'c1000000-0000-0000-0000-000000000010',
    'Pickle',
    'pickle',
    'Extra pickle.',
    50,
    '["https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=800"]',
    true,
    false,
    1,
    '["extra", "topping"]'
  ),
  (
    'a1000000-0000-0000-0000-000000000032',
    'c1000000-0000-0000-0000-000000000010',
    'Cheese Slice',
    'cheese-slice',
    'Extra cheese slice.',
    50,
    '["https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800"]',
    true,
    false,
    1,
    '["extra", "topping", "cheese"]'
  );

-- =====================================================
-- 4. DEALS / COMBOS
-- =====================================================

-- Delete existing deals
DELETE FROM deals;

INSERT INTO deals (id, name, slug, description, deal_type, original_price, discounted_price, image_url, images, is_active, is_featured, valid_from, valid_until)
VALUES
  -- Family Feast Deal
  (
    'd1000000-0000-0000-0000-000000000001',
    'Family Feast',
    'family-feast',
    'Full Broast (8 pcs) + 2 Regular Wraps + Loaded Fries + 1.5L Drink. Perfect for family gatherings!',
    'combo',
    3660,
    2999,
    'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800',
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800"]',
    true,
    true,
    NOW(),
    NOW() + INTERVAL '1 year'
  ),
  
  -- Duo Deal
  (
    'd1000000-0000-0000-0000-000000000002',
    'Duo Deal',
    'duo-deal',
    'Half Broast (4 pcs) + 2 Burgers + 2 Cold Drinks. Perfect for couples!',
    'combo',
    2350,
    1899,
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800',
    '["https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800"]',
    true,
    true,
    NOW(),
    NOW() + INTERVAL '1 year'
  ),
  
  -- Wings Party
  (
    'd1000000-0000-0000-0000-000000000003',
    'Wings Party',
    'wings-party',
    '16 Wings (Mix of Hot, Honey Lemon & Hot N Sour) + Fries + 1.5L Drink',
    'combo',
    1990,
    1599,
    'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800',
    '["https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800"]',
    true,
    false,
    NOW(),
    NOW() + INTERVAL '1 year'
  ),
  
  -- Student Special
  (
    'd1000000-0000-0000-0000-000000000004',
    'Student Special',
    'student-special',
    'Quarter Broast + Regular Wrap + Cold Drink. Budget-friendly meal!',
    'combo',
    1320,
    999,
    'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800',
    '["https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800"]',
    true,
    true,
    NOW(),
    NOW() + INTERVAL '1 year'
  ),
  
  -- Burger Combo
  (
    'd1000000-0000-0000-0000-000000000005',
    'Burger Combo',
    'burger-combo',
    'Zoro Signature Burger + Fries + Cold Drink',
    'combo',
    930,
    749,
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    '["https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800"]',
    true,
    false,
    NOW(),
    NOW() + INTERVAL '1 year'
  );

-- =====================================================
-- 5. SITE CONTENT FOR TERMS & PRIVACY PAGES
-- =====================================================

-- Delete existing site content
DELETE FROM site_content WHERE page IN ('terms', 'privacy', 'about', 'contact');

-- Terms Page Content
INSERT INTO site_content (page, section, content, is_active)
VALUES
  ('terms', 'header', '{"title": "Terms and Conditions", "subtitle": "Please read these terms carefully before using our services"}', true),
  ('terms', 'content', '{"html": "<h2>1. Acceptance of Terms</h2><p>By accessing ZOIRO Broast services, you agree to these terms.</p><h2>2. Services</h2><p>We provide food ordering and delivery services in Vehari.</p><h2>3. Orders</h2><p>All orders are subject to availability. Prices are in PKR.</p><h2>4. Delivery</h2><p>Free delivery for orders above Rs. 500. Estimated time: 30-45 minutes.</p><h2>5. Cancellation</h2><p>Orders can be cancelled within 5 minutes of placement.</p>"}', true);

-- Privacy Page Content  
INSERT INTO site_content (page, section, content, is_active)
VALUES
  ('privacy', 'header', '{"title": "Privacy Policy", "subtitle": "Your privacy is important to us"}', true),
  ('privacy', 'content', '{"html": "<h2>Information Collection</h2><p>We collect name, email, phone, and address for order processing.</p><h2>Data Usage</h2><p>Your data is used only for order fulfillment and communication.</p><h2>Security</h2><p>We implement security measures to protect your information.</p><h2>Contact</h2><p>Email: zorobroast@gmail.com, Phone: +92 304 629 2822</p>"}', true);

-- About Page Content
INSERT INTO site_content (page, section, content, is_active)
VALUES
  ('about', 'header', '{"title": "About ZOIRO Broast", "subtitle": "First Time in Vehari - Injected Broast"}', true),
  ('about', 'story', '{"text": "ZOIRO Broast brings you the most delicious, crispy, and juicy broasted chicken in Vehari. Our signature injected broast technique ensures every bite is packed with flavor - Saucy, Juicy, Crispy!"}', true);

-- Contact Page Content
INSERT INTO site_content (page, section, content, is_active)
VALUES
  ('contact', 'info', '{"email": "zorobroast@gmail.com", "phone": "+92 304 629 2822", "whatsapp": "+92 304 629 2822", "address": "Near Baba G Kulfi, Faisal Town, Vehari", "hours": "11:00 AM - 11:00 PM (Daily)"}', true);

-- =====================================================
-- 6. UPDATE INVOICE BRAND INFO DEFAULT
-- =====================================================

-- Update default brand info for invoices
UPDATE invoices 
SET brand_info = '{
  "name": "ZOIRO Broast",
  "tagline": "Injected Broast - Saucy. Juicy. Crispy.",
  "email": "zorobroast@gmail.com",
  "phone": "+92 304 629 2822",
  "address": "Near Baba G Kulfi, Faisal Town, Vehari",
  "logo_url": "/assets/zoiro-logo.png",
  "ntn": "XXXXXXX"
}'::jsonb
WHERE brand_info IS NULL OR brand_info->>'email' = 'info@zoiro.com';

-- =====================================================
-- 7. VERIFICATION QUERIES
-- =====================================================

-- Verify categories inserted
-- SELECT id, name, display_order FROM menu_categories ORDER BY display_order;

-- Verify menu items count by category
-- SELECT mc.name as category, COUNT(mi.id) as items 
-- FROM menu_categories mc 
-- LEFT JOIN menu_items mi ON mc.id = mi.category_id 
-- GROUP BY mc.name 
-- ORDER BY mc.display_order;

-- Verify deals
-- SELECT name, original_price, discounted_price FROM deals;

-- Verify website content
-- SELECT key, title FROM website_content;

-- =====================================================
-- END OF SCRIPT
-- =====================================================
