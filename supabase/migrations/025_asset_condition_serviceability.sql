-- Replace the five-level condition scale with operational serviceability.
-- Existing "fair" assets remain serviceable; poor/damaged assets are
-- considered unserviceable.
ALTER TABLE assets ALTER COLUMN condition DROP DEFAULT;
ALTER TABLE inspections ALTER COLUMN condition DROP DEFAULT;

ALTER TYPE asset_condition RENAME TO asset_condition_legacy;
CREATE TYPE asset_condition AS ENUM ('serviceable', 'unserviceable');

ALTER TABLE assets
  ALTER COLUMN condition TYPE asset_condition
  USING (
    CASE condition::text
      WHEN 'excellent' THEN 'serviceable'
      WHEN 'good' THEN 'serviceable'
      WHEN 'fair' THEN 'serviceable'
      WHEN 'poor' THEN 'unserviceable'
      WHEN 'damaged' THEN 'unserviceable'
      WHEN 'serviceable' THEN 'serviceable'
      WHEN 'unserviceable' THEN 'unserviceable'
      ELSE condition::text
    END
  )::asset_condition;

ALTER TABLE inspections
  ALTER COLUMN condition TYPE asset_condition
  USING (
    CASE condition::text
      WHEN 'excellent' THEN 'serviceable'
      WHEN 'good' THEN 'serviceable'
      WHEN 'fair' THEN 'serviceable'
      WHEN 'poor' THEN 'unserviceable'
      WHEN 'damaged' THEN 'unserviceable'
      WHEN 'serviceable' THEN 'serviceable'
      WHEN 'unserviceable' THEN 'unserviceable'
      ELSE condition::text
    END
  )::asset_condition;

ALTER TABLE assets ALTER COLUMN condition SET DEFAULT 'serviceable';
DROP TYPE asset_condition_legacy;
