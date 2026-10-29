CREATE SEQUENCE IF NOT EXISTS public.asset_number_seq;

DO $$
DECLARE
  current_max bigint;
BEGIN
  SELECT COALESCE(
    MAX((regexp_match(asset_number, '^KD-[0-9]{4}-([0-9]+)$'))[1]::bigint),
    0
  )
  INTO current_max
  FROM public.assets;

  PERFORM setval('public.asset_number_seq', GREATEST(current_max, 1), current_max > 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_asset_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH next_number AS (
    SELECT nextval('public.asset_number_seq') AS value
  )
  SELECT 'KD-' || to_char(current_date, 'YYYY') || '-' ||
    CASE
      WHEN value < 1000000 THEN lpad(value::text, 6, '0')
      ELSE value::text
    END
  FROM next_number;
$$;

REVOKE ALL ON FUNCTION public.generate_asset_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_asset_number() TO authenticated, service_role;
