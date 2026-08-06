-- Migration: Allow organization admins to create and manage assets for their own organization
-- Purpose: Enable RLS-based asset creation for ministry/department/agency admins

ALTER TABLE IF EXISTS assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assets_select_org_admins ON assets;
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

DROP POLICY IF EXISTS assets_insert_org_admins ON assets;
CREATE POLICY assets_insert_org_admins ON assets
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.current_user_role() = 'super_admin'
      OR (
        public.current_user_organization_id() IS NOT NULL
        AND public.current_user_organization_id() = assets.organization_id
      )
    )
  );

DROP POLICY IF EXISTS assets_update_org_admins ON assets;
CREATE POLICY assets_update_org_admins ON assets
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.current_user_role() = 'super_admin'
      OR (
        public.current_user_organization_id() IS NOT NULL
        AND public.current_user_organization_id() = assets.organization_id
      )
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.current_user_role() = 'super_admin'
      OR (
        public.current_user_organization_id() IS NOT NULL
        AND public.current_user_organization_id() = assets.organization_id
      )
    )
  );
