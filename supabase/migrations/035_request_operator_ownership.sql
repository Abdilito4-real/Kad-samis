ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS workflow_owner_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'requests_workflow_owner_id_fkey'
      AND conrelid = 'public.requests'::regclass
  ) THEN
    ALTER TABLE public.requests
      ADD CONSTRAINT requests_workflow_owner_id_fkey
      FOREIGN KEY (workflow_owner_id) REFERENCES public.profiles(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_requests_workflow_owner
  ON public.requests(workflow_owner_id, workflow_stage, status);

UPDATE public.requests r
SET workflow_owner_id = r.created_by
FROM public.profiles p
WHERE r.workflow_owner_id IS NULL
  AND r.created_by = p.id
  AND p.role IN ('mechanical_request_handler', 'electrical_mechanical_handler');

UPDATE public.requests r
SET workflow_owner_id = (
  SELECT al.user_id
  FROM public.audit_logs al
  JOIN public.profiles p ON p.id = al.user_id
  WHERE al.table_name = 'requests'
    AND al.record_id = r.id
    AND al.action = 'forwarded_to_assistant_director_operations'
    AND p.role IN ('mechanical_request_handler', 'electrical_mechanical_handler')
  ORDER BY al.timestamp ASC
  LIMIT 1
)
WHERE r.workflow_owner_id IS NULL
  AND r.workflow_stage IN ('assistant_director_operations', 'director_operations', 'agency_admin')
  AND EXISTS (
    SELECT 1
    FROM public.audit_logs al
    JOIN public.profiles p ON p.id = al.user_id
    WHERE al.table_name = 'requests'
      AND al.record_id = r.id
      AND al.action = 'forwarded_to_assistant_director_operations'
      AND p.role IN ('mechanical_request_handler', 'electrical_mechanical_handler')
  );

DROP POLICY IF EXISTS requests_select_super_or_org ON public.requests;
CREATE POLICY requests_select_super_or_org ON public.requests
  FOR SELECT
  USING (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'operational_manager'
      AND assigned_operator_id = auth.uid()
    )
    OR (
      organization_id = public.current_user_organization_id()
      AND (
        public.current_user_role() NOT IN (
          'mechanical_request_handler',
          'electrical_mechanical_handler'
        )
        OR workflow_owner_id = auth.uid()
        OR (
          workflow_owner_id IS NULL
          AND workflow_stage IN ('mechanical', 'electrical_mechanical')
          AND status = 'pending'
        )
      )
    )
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
          AND (workflow_owner_id IS NULL OR workflow_owner_id = auth.uid())
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
          AND workflow_owner_id = auth.uid()
        )
        OR (
          public.current_user_role() = 'assistant_director_operations'
          AND workflow_stage = 'director_operations'
          AND status = 'escalated'
        )
        OR (
          public.current_user_role() = 'assistant_director_operations'
          AND workflow_stage = 'mechanical'
          AND status = 'pending'
          AND workflow_owner_id IS NOT NULL
        )
        OR (
          public.current_user_role() = 'director_operations'
          AND workflow_stage = 'agency_admin'
          AND status = 'escalated'
        )
        OR (
          public.current_user_role() = 'director_operations'
          AND workflow_stage = 'assistant_director_operations'
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

DROP POLICY IF EXISTS request_operations_select ON public.request_operations;
CREATE POLICY request_operations_select ON public.request_operations
  FOR SELECT
  USING (
    public.current_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.requests r
      WHERE r.id = request_operations.request_id
        AND (
          (
            public.current_user_role() = 'operational_manager'
            AND r.assigned_operator_id = auth.uid()
          )
          OR (
            r.organization_id = public.current_user_organization_id()
            AND (
              public.current_user_role() NOT IN (
                'mechanical_request_handler',
                'electrical_mechanical_handler'
              )
              OR r.workflow_owner_id = auth.uid()
              OR (
                r.workflow_owner_id IS NULL
                AND r.workflow_stage IN ('mechanical', 'electrical_mechanical')
                AND r.status = 'pending'
              )
            )
          )
        )
    )
  );
