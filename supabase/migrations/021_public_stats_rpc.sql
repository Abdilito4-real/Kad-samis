-- Collapses the 7 separate Supabase queries GET /api/public/stats used to
-- fire in parallel (assets count, a full purchase_value select summed in
-- JS, organizations/profiles/requests/pending-requests/inspections counts)
-- into one round-trip. Load-testing that route found the old version
-- taking 5-16+ seconds under ~30 concurrent requests — up to 7x that many
-- simultaneous outbound connections to Supabase per incoming request, from
-- a single unauthenticated, publicly-hittable marketing-page endpoint.
--
-- SECURITY DEFINER + a narrow anon GRANT is deliberate and safe here, not
-- a shortcut: the route already documented why it needs to see past RLS
-- ("numbers reflect the whole platform... never row-level data") and used
-- the service-role key to do it. This function returns only aggregates —
-- counts and one sum — never a row, so it carries the same guarantee
-- explicitly rather than incidentally via whichever key happened to be
-- configured.

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
    (SELECT count(*) FROM assets) AS assets_count,
    (SELECT coalesce(sum(purchase_value), 0) FROM assets) AS total_asset_value,
    (SELECT count(*) FROM organizations) AS organizations_count,
    (SELECT count(*) FROM profiles) AS users_count,
    (SELECT count(*) FROM requests) AS requests_count,
    (SELECT count(*) FROM requests WHERE status = 'pending') AS pending_requests_count,
    (SELECT count(*) FROM inspections) AS inspections_count;
$$;

-- Callable by both an anonymous caller (the anon key, RLS bypassed only
-- inside this function's own fixed aggregate query) and the service role
-- (already bypasses RLS regardless) — the route picks whichever key is
-- configured, and this works the same either way.
GRANT EXECUTE ON FUNCTION public_platform_stats() TO anon, authenticated, service_role;
