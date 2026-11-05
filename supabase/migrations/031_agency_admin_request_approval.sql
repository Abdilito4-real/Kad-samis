UPDATE public.requests
SET workflow_stage = 'agency_admin'
WHERE workflow_stage = 'general_admin'
  AND status = 'escalated';

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
        OR (
          public.current_user_role() = 'agency_admin'
          AND workflow_stage = 'agency_admin'
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
          AND workflow_stage = 'agency_admin'
          AND status = 'escalated'
        )
        OR (
          public.current_user_role() = 'agency_admin'
          AND workflow_stage = 'agency_admin'
          AND status IN ('approved', 'rejected')
        )
      )
    )
  );
