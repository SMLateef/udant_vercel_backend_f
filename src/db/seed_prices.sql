-- Mandi Price Records Table
CREATE TABLE IF NOT EXISTS mandi_price_records (
    id SERIAL PRIMARY KEY,
    commodity_id INTEGER NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
    variety_id INTEGER REFERENCES commodity_varieties(id),
    state_id INTEGER NOT NULL REFERENCES states(id),
    district_id INTEGER NOT NULL REFERENCES districts(id),
    mandi_name VARCHAR(150) NOT NULL,
    arrival_volume_mt NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_price NUMERIC(10,2) NOT NULL,
    max_price NUMERIC(10,2) NOT NULL,
    modal_price NUMERIC(10,2) NOT NULL,
    price_unit VARCHAR(20) NOT NULL DEFAULT 'quintal',
    price_change_pct NUMERIC(5,2) DEFAULT 0, -- e.g. +2.50 or -1.20%
    price_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mandi_prices_commodity ON mandi_price_records(commodity_id);
CREATE INDEX IF NOT EXISTS idx_mandi_prices_location ON mandi_price_records(state_id, district_id);
CREATE INDEX IF NOT EXISTS idx_mandi_prices_date ON mandi_price_records(price_date DESC);

-- Clear previous test price records
TRUNCATE TABLE mandi_price_records RESTART IDENTITY CASCADE;

-- Seed Real APMC Mandi Benchmark Records
INSERT INTO mandi_price_records (commodity_id, variety_id, state_id, district_id, mandi_name, arrival_volume_mt, min_price, max_price, modal_price, price_unit, price_change_pct, price_date)
VALUES 
(1, 1, 1, 101, 'Nizamabad APMC Yard', 85.50, 13800.00, 15200.00, 14500.00, 'quintal', 3.40, CURRENT_DATE),
(2, 2, 3, 104, 'Guntur Mirchi Yard', 140.00, 19500.00, 22400.00, 21000.00, 'quintal', -1.20, CURRENT_DATE),
(3, 3, 2, 103, 'Nashik Agricultural Produce Market', 310.00, 2100.00, 2650.00, 2400.00, 'quintal', 5.80, CURRENT_DATE),
(4, 4, 1, 101, 'Nizamabad Grain Market', 190.00, 4400.00, 5100.00, 4800.00, 'quintal', 0.50, CURRENT_DATE),
(5, 5, 4, 105, 'Khanna APMC Mandi', 450.00, 2250.00, 2550.00, 2420.00, 'quintal', 1.10, CURRENT_DATE),
(1, 1, 1, 102, 'Warangal Rural Mandi', 45.00, 13500.00, 14800.00, 14100.00, 'quintal', -0.80, CURRENT_DATE),
(3, 3, 5, 106, 'Indore Choithram Mandi', 220.00, 2000.00, 2500.00, 2300.00, 'quintal', 2.20, CURRENT_DATE);