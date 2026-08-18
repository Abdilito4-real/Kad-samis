-- Re-adds geolocation to assets, one of the columns dropped in
-- 016_assets_csv_schema.sql when the schema was trimmed to exactly the CSV
-- template's fields. Brought back as an optional "Geolocation" column in
-- that same template (src/lib/assetImport.ts) — a single "latitude,
-- longitude" cell on import/export, stored as the same split
-- latitude/longitude numeric columns buildings/facilities/inspections
-- already use (see 001_initial_schema.sql), not a new representation.
--
-- Both nullable: geolocation is optional per-asset, matching every other
-- non-required CSV column (make, purchase year/value, warranty years).

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

COMMENT ON COLUMN assets.latitude IS 'Optional GPS latitude, -90 to 90. Paired with longitude via the CSV template''s single "Geolocation" column.';
COMMENT ON COLUMN assets.longitude IS 'Optional GPS longitude, -180 to 180. Paired with latitude via the CSV template''s single "Geolocation" column.';
