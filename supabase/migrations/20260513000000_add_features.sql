-- Migration: add_features
-- Adds phone to persons, review_date to cautelas, and creates ammo_batches table

-- 1. Add phone column to persons table
ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Add review_date column to cautelas table
ALTER TABLE cautelas
  ADD COLUMN IF NOT EXISTS review_date TIMESTAMPTZ;

-- 3. Create ammo_batches table
CREATE TABLE IF NOT EXISTS ammo_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibre TEXT NOT NULL,
  marca TEXT,
  quantity_total INTEGER NOT NULL DEFAULT 0,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  lot_number TEXT,
  acquisition_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ammo_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ammo_batches"
  ON ammo_batches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ammo_batches"
  ON ammo_batches FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update ammo_batches"
  ON ammo_batches FOR UPDATE TO authenticated USING (true);
