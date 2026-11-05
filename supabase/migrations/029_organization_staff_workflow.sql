ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'mechanical_request_handler';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'electrical_mechanical_handler';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'custodian';

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS workflow_stage TEXT;

CREATE INDEX IF NOT EXISTS idx_requests_workflow_org
  ON public.requests(organization_id, workflow_stage, status);

DROP POLICY IF EXISTS requests_update_policy ON public.requests;
CREATE POLICY requests_update_policy ON public.requests
  FOR UPDATE
  USING (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'operational_manager'
      AND assigned_operator_id = auth.uid()
    )
    OR (
      organization_id = public.current_user_organization_id()
      AND (
        (
          public.current_user_role() = 'mechanical_request_handler'
          AND (workflow_stage = 'mechanical' OR workflow_stage IS NULL)
          AND status = 'pending'
        )
        OR (
          public.current_user_role() = 'electrical_mechanical_handler'
          AND workflow_stage = 'electrical_mechanical'
          AND status = 'escalated'
        )
      )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'operational_manager'
      AND assigned_operator_id = auth.uid()
    )
    OR (
      organization_id = public.current_user_organization_id()
      AND (
        (
          public.current_user_role() = 'mechanical_request_handler'
          AND workflow_stage = 'electrical_mechanical'
          AND status = 'escalated'
        )
        OR (
          public.current_user_role() = 'electrical_mechanical_handler'
          AND workflow_stage = 'general_admin'
          AND status = 'escalated'
        )
      )
    )
  );

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
          'asset_officer',
          'custodian'
        )
        AND public.current_user_organization_id() IS NOT NULL
        AND public.current_user_organization_id() = organization_id
      )
    )
  );
