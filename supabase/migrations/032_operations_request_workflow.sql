ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'assistant_director_operations';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'director_operations';

UPDATE public.requests
SET workflow_stage = CASE
  WHEN workflow_stage = 'electrical_mechanical' AND status = 'escalated'
    THEN 'assistant_director_operations'
  WHEN workflow_stage IN ('general_admin', 'agency_admin') AND status = 'escalated'
    THEN 'director_operations'
  ELSE 'mechanical'
END,
escalated_at = CASE
  WHEN workflow_stage IN ('electrical_mechanical', 'general_admin', 'agency_admin') AND status = 'escalated'
    THEN escalated_at
  ELSE NULL
END,
escalated_by = CASE
  WHEN workflow_stage IN ('electrical_mechanical', 'general_admin', 'agency_admin') AND status = 'escalated'
    THEN escalated_by
  ELSE NULL
END
WHERE (
    workflow_stage = 'electrical_mechanical'
    AND status IN ('pending', 'escalated')
  )
  OR (
    workflow_stage IN ('general_admin', 'agency_admin')
    AND status = 'escalated'
  );

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
          public.current_user_role() IN ('mechanical_request_handler', 'electrical_mechanical_handler')
          AND (workflow_stage = 'mechanical' OR workflow_stage IS NULL)
          AND status = 'pending'
        )
        OR (
          public.current_user_role() = 'assistant_director_operations'
          AND workflow_stage = 'assistant_director_operations'
          AND status = 'escalated'
        )
        OR (
          public.current_user_role() = 'director_operations'
          AND workflow_stage = 'director_operations'
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
          public.current_user_role() IN ('mechanical_request_handler', 'electrical_mechanical_handler')
          AND workflow_stage = 'assistant_director_operations'
          AND status = 'escalated'
        )
        OR (
          public.current_user_role() = 'assistant_director_operations'
          AND workflow_stage = 'director_operations'
          AND status = 'escalated'
        )
        OR (
          public.current_user_role() = 'director_operations'
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
