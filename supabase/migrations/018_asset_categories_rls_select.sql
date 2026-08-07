-- asset_categories has Row Level Security enabled (turned on directly in
-- Supabase at some point — it's not in any migration file, and RLS with no
-- policy at all silently denies every row to any non-superuser role rather
-- than erroring, which is why the app saw "0 rows, no error" even after
-- 017 successfully seeded 5 categories via the SQL Editor's elevated role).
--
-- Categories are shared reference data (name/code/description/
-- depreciation_rate) used across every organization — nothing
-- organization-scoped or sensitive — so a blanket read policy is
-- appropriate. Writes are intentionally left with no policy (default
-- deny): category management stays a SQL-only, super-admin operation for
-- now.
DROP POLICY IF EXISTS asset_categories_select_all ON asset_categories;
CREATE POLICY asset_categories_select_all
  ON asset_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);
