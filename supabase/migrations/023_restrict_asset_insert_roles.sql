DROP POLICY IF EXISTS assets_insert_org_admins ON public.assets;
DROP POLICY IF EXISTS assets_insert_asset_managers ON public.assets;

CREATE POLICY assets_insert_asset_managers ON public.assets
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.current_user_role() = 'super_admin'
      OR (
        public.current_user_role() IN (
          'agency_admin',
          'ministry_admin',
          'department_head',
          'asset_officer'
        )
        AND public.current_user_organization_id() IS NOT NULL
        AND public.current_user_organization_id() = organization_id
      )
    )
  );
