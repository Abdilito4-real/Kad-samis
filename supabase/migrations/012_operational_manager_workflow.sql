-- 012_operational_manager_workflow.sql
-- Adds the Operational Manager role and the post-approval "operations" phase
-- for maintenance/repair requests (type = 'maintenance_approval'):
--   org submits -> super_admin approves -> super_admin assigns an
--   Operational Manager -> operator drives the work through fixed stages
--   (assigned -> monitoring -> in_progress -> completed), logging a note at
--   each transition. Org admins and super_admin can read the timeline
--   throughout.

-- 1) New global role. ALTER TYPE ... ADD VALUE cannot run inside the same
-- transaction block as statements that use the new value, so it must be its
-- own top-level statement (same approach as migration 008's 'escalated').
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'operational_manager';

-- 2) New mid-flow request status. 'completed' already exists and becomes the
-- terminal state once the operator logs the final stage.
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'in_operation';

-- 3) Fixed, ordered stage list for the operations phase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_stage') THEN
    CREATE TYPE operation_stage AS ENUM ('assigned', 'monitoring', 'in_progress', 'completed');
  END IF;
END$$;

-- 4) Assignment columns on requests. Reference profiles(id) (not
-- auth.users(id)) so PostgREST can embed the operator's profile the same way
-- `organizations(name)` is already embedded on this table.
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS assigned_operator_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS current_stage operation_stage,
  ADD COLUMN IF NOT EXISTS operation_completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_requests_assigned_operator ON requests(assigned_operator_id);

-- 5) Stage timeline. One row per transition, including the initial
-- "assigned" entry, so the full history is reconstructible.
CREATE TABLE IF NOT EXISTS request_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  stage operation_stage NOT NULL,
  note TEXT,
  actor_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_operations_request ON request_operations(request_id);

ALTER TABLE request_operations ENABLE ROW LEVEL SECURITY;

-- 6) RLS: requests SELECT — add operational_manager visibility into their
-- own assigned rows, on top of the existing super_admin/org-member access.
DROP POLICY IF EXISTS requests_select_super_or_org ON requests;
CREATE POLICY requests_select_super_or_org ON requests
  FOR SELECT
  USING (
    public.current_user_role() = 'super_admin'
    OR public.current_user_organization_id() = requests.organization_id
    OR (public.current_user_role() = 'operational_manager' AND requests.assigned_operator_id = auth.uid())
  );

-- 7) RLS: requests UPDATE — was super_admin-only, which meant the existing
-- org-admin escalate endpoint (PATCH .../escalate, run as the org-admin user
-- via the anon-key/bearer client) could never satisfy RLS. This policy adds
-- the assigned operational_manager and restores org-admin escalate rights on
-- their own pending requests; the exact columns each caller may touch are
-- still enforced in the API routes, not here.
DROP POLICY IF EXISTS requests_update_super_only ON requests;
DROP POLICY IF EXISTS requests_update_policy ON requests;
CREATE POLICY requests_update_policy ON requests
  FOR UPDATE
  USING (
    public.current_user_role() = 'super_admin'
    OR (public.current_user_role() = 'operational_manager' AND requests.assigned_operator_id = auth.uid())
    OR (public.current_user_organization_id() = requests.organization_id AND requests.status = 'pending')
  )
  WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (public.current_user_role() = 'operational_manager' AND requests.assigned_operator_id = auth.uid())
    OR public.current_user_organization_id() = requests.organization_id
  );

-- 8) RLS: request_operations — visible to super_admin, the request's own
-- organization, and the assigned operator; only super_admin or the assigned
-- operator may insert new stage entries.
DROP POLICY IF EXISTS request_operations_select ON request_operations;
CREATE POLICY request_operations_select ON request_operations
  FOR SELECT
  USING (
    public.current_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_operations.request_id
        AND (
          r.organization_id = public.current_user_organization_id()
          OR r.assigned_operator_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS request_operations_insert ON request_operations;
CREATE POLICY request_operations_insert ON request_operations
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'super_admin'
    OR (
      public.current_user_role() = 'operational_manager'
      AND EXISTS (
        SELECT 1 FROM requests r
        WHERE r.id = request_operations.request_id
          AND r.assigned_operator_id = auth.uid()
      )
    )
  );

-- 9) Notifications: operators need to notify org admins/super_admin on stage
-- changes, so they must be allowed to insert notifications too.
DROP POLICY IF EXISTS notifications_insert_super_admin ON notifications;
CREATE POLICY notifications_insert_super_admin ON notifications
  FOR INSERT
  WITH CHECK (public.current_user_role() IN ('super_admin', 'operational_manager'));
