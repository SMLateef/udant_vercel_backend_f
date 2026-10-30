-- Clean existing reference and listing data
TRUNCATE TABLE commodity_listings, commodity_varieties, commodities, commodity_categories, districts, states CASCADE;

-- 1. States & Districts
INSERT INTO states (id, name, code) VALUES
(1, 'Telangana', 'TS'),
(2, 'Maharashtra', 'MH'),
(3, 'Andhra Pradesh', 'AP'),
(4, 'Punjab', 'PB'),
(5, 'Madhya Pradesh', 'MP');

INSERT INTO districts (id, state_id, name) VALUES
(101, 1, 'Nizamabad'),
(102, 1, 'Warangal'),
(103, 2, 'Nashik'),
(104, 3, 'Guntur'),
(105, 4, 'Khanna'),
(106, 5, 'Indore');

-- 2. Commodity Categories & Commodities
INSERT INTO commodity_categories (id, name) VALUES
(1, 'Spices'),
(2, 'Vegetables'),
(3, 'Cereals & Grains'),
(4, 'Pulses');

INSERT INTO commodities (id, category_id, name, default_unit) VALUES
(1, 1, 'Turmeric', 'MT'),
(2, 1, 'Red Chilli', 'MT'),
(3, 2, 'Onion', 'MT'),
(4, 3, 'Paddy / Rice', 'MT'),
(5, 3, 'Wheat', 'MT');

INSERT INTO commodity_varieties (id, commodity_id, name) VALUES
(1, 1, 'Nizamabad Finger Turmeric'),
(2, 2, 'Guntur Teja (S17)'),
(3, 3, 'Nashik Red Garwa'),
(4, 4, 'Sona Masoori Raw'),
(5, 5, 'Sharbati Grain');

-- 3. Create Demo Seller (if not exists)
INSERT INTO users (id, name, phone, role, is_active)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Ramesh Farmer Collective (FPO)', '9876543210', 'farmer', true),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Deccan Agri Traders', '9876543211', 'supplier', true)
ON CONFLICT (phone) DO NOTHING;

-- Ensure farmer profiles exist for demo sellers
INSERT INTO farmer_profiles (user_id, farm_name, state_id, district_id, farm_size_acres, production_capacity_mt, verification_status, rating_avg)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Green Agro Farmers FPO', 1, 101, 150.00, 500.00, 'verified', 4.8),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Deccan Spices Warehouse', 3, 104, 50.00, 1200.00, 'verified', 4.6)
ON CONFLICT (user_id) DO NOTHING;

-- 4. B2B Commodity Listings with Quality Parameters (JSONB)
INSERT INTO commodity_listings (
  seller_id, commodity_id, variety_id, grade, quantity, unit, min_order_quantity,
  price_amount, price_unit, price_type, state_id, district_id, quality_parameters, description, status
) VALUES
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, 1, 'Grade A Export', 25.00, 'MT', 2.00,
  14500.00, 'quintal', 'fixed', 1, 101,
  '{"moisture": "8.5%", "curcumin_content": "4.2%", "crop_year": "2026", "polishing": "Double Polished", "organic_certified": true}'::jsonb,
  'Premium double-polished Nizamabad finger turmeric with high curcumin content. Cleaned and sun-dried directly from FPO farms in Nizamabad.',
  'active'
),
(
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 2, 2, 'Stemless Grade 1', 40.00, 'MT', 5.00,
  21000.00, 'quintal', 'negotiable', 3, 104,
  '{"moisture": "10.0%", "asta_color": "60-70", "pungency_shu": "75000", "stem_status": "Stemless", "foreign_matter": "0.5%"}'::jsonb,
  'Deep red, highly pungent Guntur Teja red chillies. ideal for spice grinding units and direct export. Cold storage stock available.',
  'active'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 3, 3, 'Medium 55mm+', 100.00, 'MT', 10.00,
  2400.00, 'quintal', 'negotiable', 2, 103,
  '{"size_mm": "55-60mm", "moisture": "12.0%", "shelf_life": "60 Days", "packaging": "50kg Jute Bags"}'::jsonb,
  'Fresh harvest Nashik Garwa Red Onions. Firm bulbs with good outer skin, suitable for long-distance transport and exports.',
  'active'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 4, 4, 'Super Premium', 60.00, 'MT', 5.00,
  4800.00, 'quintal', 'fixed', 1, 101,
  '{"grain_length": "5.4mm", "moisture": "11.0%", "broken_grains": "1.5%", "milling_type": "Raw Aged 12 Months"}'::jsonb,
  'Aged Sona Masoori raw rice processed in Nizamabad mills. Non-sticky texture upon cooking, ideal for institutional buyers and caterers.',
  'active'
);