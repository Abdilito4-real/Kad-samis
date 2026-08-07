-- Replace the asset intake form with a CSV template + import flow.
-- The assets table is trimmed down to exactly the fields captured by the
-- CSV template: Assets Name, Make, Year (of purchase), Purchase Value,
-- Condition, Assets ID or Number, Warranty Years, Status, Category.
-- ("SN" in the template is a spreadsheet row number for the user's own
-- bookkeeping — it is never stored.)
--
-- Columns removed: qr_code, barcode, subcategory_id, model, serial_number,
-- purchase_date, current_value, depreciation_rate, warranty_expiry,
-- funding_source, supplier_id, latitude, longitude, building_id, floor_id,
-- room_id, assigned_officer_id, notes. None of these are referenced by any
-- RLS policy, trigger, or view — safe to drop outright.
--
-- Every step below is guarded with an information_schema/pg_constraint
-- check rather than assuming the table matches 001/003's original
-- definition — the live table has already drifted from those files once
-- (this migration originally failed with "column manufacturer does not
-- exist"), so each rename/add/constraint only runs if its precondition
-- actually holds. Safe to run more than once.

-- 1) Rename columns that map 1:1 onto a renamed CSV field — but only if
--    the old name exists and the new name doesn't already exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'manufacturer')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'make') THEN
    ALTER TABLE assets RENAME COLUMN manufacturer TO make;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'purchase_price')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'purchase_value') THEN
    ALTER TABLE assets RENAME COLUMN purchase_price TO purchase_value;
  END IF;
END $$;

-- 2) Make sure every target column exists, whether or not step 1 found
--    something to rename it from.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS make TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_value DECIMAL(15, 2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_year INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_years INTEGER;

-- 3) Best-effort backfill from the columns being dropped (only if they're
--    actually present), so existing assets keep an approximate purchase
--    year / warranty duration instead of going blank.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'purchase_date') THEN
    UPDATE assets
    SET purchase_year = EXTRACT(YEAR FROM purchase_date)::int
    WHERE purchase_date IS NOT NULL AND purchase_year IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'warranty_expiry')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'purchase_date') THEN
    UPDATE assets
    SET warranty_years = GREATEST(0, EXTRACT(YEAR FROM warranty_expiry)::int - EXTRACT(YEAR FROM purchase_date)::int)
    WHERE warranty_expiry IS NOT NULL AND purchase_date IS NOT NULL AND warranty_years IS NULL;
  END IF;
END $$;

-- 4) Sanity constraints matching how these are validated on import.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_purchase_year_range') THEN
    ALTER TABLE assets ADD CONSTRAINT assets_purchase_year_range
      CHECK (purchase_year IS NULL OR (purchase_year BETWEEN 1900 AND 2100));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_warranty_years_nonnegative') THEN
    ALTER TABLE assets ADD CONSTRAINT assets_warranty_years_nonnegative
      CHECK (warranty_years IS NULL OR warranty_years >= 0);
  END IF;
END $$;

-- 5) Drop every column no longer part of the schema (already safe if a
--    given column doesn't exist).
ALTER TABLE assets
  DROP COLUMN IF EXISTS qr_code,
  DROP COLUMN IF EXISTS barcode,
  DROP COLUMN IF EXISTS subcategory_id,
  DROP COLUMN IF EXISTS model,
  DROP COLUMN IF EXISTS serial_number,
  DROP COLUMN IF EXISTS purchase_date,
  DROP COLUMN IF EXISTS current_value,
  DROP COLUMN IF EXISTS depreciation_rate,
  DROP COLUMN IF EXISTS warranty_expiry,
  DROP COLUMN IF EXISTS funding_source,
  DROP COLUMN IF EXISTS supplier_id,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS building_id,
  DROP COLUMN IF EXISTS floor_id,
  DROP COLUMN IF EXISTS room_id,
  DROP COLUMN IF EXISTS assigned_officer_id,
  DROP COLUMN IF EXISTS notes;

-- idx_assets_building was indexing a column we just dropped; Postgres drops
-- it automatically with the column, but be explicit in case it was ever
-- recreated by hand.
DROP INDEX IF EXISTS idx_assets_building;
