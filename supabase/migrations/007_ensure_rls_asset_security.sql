-- Migration 007: Ensure asset RLS is fully functional
-- This migration verifies that all necessary functions and policies exist

-- Ensure the current_user_role function exists and is correct
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Ensure the current_user_organization_id function exists and is correct
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Ensure assets table has organization_id column
ALTER TABLE IF EXISTS assets
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Ensure the index exists for performance
CREATE INDEX IF NOT EXISTS idx_assets_organization ON assets(organization_id);

-- Ensure RLS is enabled on assets table
ALTER TABLE IF EXISTS assets ENABLE ROW LEVEL SECURITY;

-- Verify the SELECT policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'assets' AND policyname = 'assets_select_org_admins'
  ) THEN
    CREATE POLICY assets_select_org_admins ON assets
      FOR SELECT
      USING (
        auth.uid() IS NOT NULL
        AND (
          public.current_user_role() = 'super_admin'
          OR (
            public.current_user_organization_id() IS NOT NULL
            AND public.current_user_organization_id() = assets.organization_id
          )
        )
      );
  END IF;
END $$;

-- Add organization_id to profiles if missing (for user->org mapping)
ALTER TABLE IF EXISTS profiles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id);
