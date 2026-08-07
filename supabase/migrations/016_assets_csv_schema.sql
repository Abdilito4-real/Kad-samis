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

-- 1) Rename columns that map 1:1 onto a renamed CSV field.
ALTER TABLE assets RENAME COLUMN manufacturer TO make;
ALTER TABLE assets RENAME COLUMN purchase_price TO purchase_value;

-- 2) Add the two fields that replace date-based columns with plain
--    integers (the CSV template only asks for a year / a duration).
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_year INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_years INTEGER;

-- 3) Best-effort backfill from the columns being dropped, so existing
--    assets keep an approximate purchase year / warranty duration instead
--    of going blank.
UPDATE assets
SET purchase_year = EXTRACT(YEAR FROM purchase_date)::int
WHERE purchase_date IS NOT NULL AND purchase_year IS NULL;

UPDATE assets
SET warranty_years = GREATEST(0, EXTRACT(YEAR FROM warranty_expiry)::int - EXTRACT(YEAR FROM purchase_date)::int)
WHERE warranty_expiry IS NOT NULL AND purchase_date IS NOT NULL AND warranty_years IS NULL;

-- 4) Sanity constraints matching how these are validated on import.
ALTER TABLE assets ADD CONSTRAINT assets_purchase_year_range
  CHECK (purchase_year IS NULL OR (purchase_year BETWEEN 1900 AND 2100));
ALTER TABLE assets ADD CONSTRAINT assets_warranty_years_nonnegative
  CHECK (warranty_years IS NULL OR warranty_years >= 0);

-- 5) Drop every column no longer part of the schema.
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
