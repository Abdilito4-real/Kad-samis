-- Adds a free-text "Geolocation" column to assets — the physical address
-- or location description for the asset (e.g. "12 Ahmadu Bello Way,
-- Kaduna"), not GPS coordinates. Optional, matching every other
-- non-required CSV column (make, purchase year/value, warranty years).

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS geolocation TEXT;

COMMENT ON COLUMN assets.geolocation IS 'Optional free-text location/address for the asset, set via the CSV template''s "Geolocation" column.';
