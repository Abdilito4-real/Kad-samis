-- Soft-deleted assets remain available for historical references but are
-- excluded from platform-wide active asset counts and valuation.
CREATE OR REPLACE FUNCTION public_platform_stats()
RETURNS TABLE (
  assets_count bigint,
  total_asset_value numeric,
  organizations_count bigint,
  users_count bigint,
  requests_count bigint,
  pending_requests_count bigint,
  inspections_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM assets WHERE deleted_at IS NULL) AS assets_count,
    (SELECT coalesce(sum(purchase_value), 0) FROM assets WHERE deleted_at IS NULL) AS total_asset_value,
    (SELECT count(*) FROM organizations) AS organizations_count,
    (SELECT count(*) FROM profiles) AS users_count,
    (SELECT count(*) FROM requests) AS requests_count,
    (SELECT count(*) FROM requests WHERE status = 'pending') AS pending_requests_count,
    (SELECT count(*) FROM inspections) AS inspections_count;
$$;
