WITH rerouted_requests AS (
  UPDATE public.requests r
  SET workflow_stage = 'assistant_director_operations',
      status = 'escalated',
      escalated_at = COALESCE(r.escalated_at, r.created_at, NOW()),
      escalated_by = COALESCE(r.escalated_by, r.workflow_owner_id, r.created_by),
      escalation_reason = COALESCE(
        NULLIF(r.escalation_reason, ''),
        'Submitted by a Requests Operator'
      ),
      updated_at = NOW()
  FROM public.profiles handler_profile
  WHERE r.workflow_stage IN ('mechanical', 'electrical_mechanical')
    AND r.status = 'pending'
    AND handler_profile.id = COALESCE(r.workflow_owner_id, r.created_by)
    AND handler_profile.role IN ('mechanical_request_handler', 'electrical_mechanical_handler')
  RETURNING r.id, r.title, r.workflow_owner_id, r.organization_id
)
INSERT INTO public.notifications (user_id, type, title, message, related_request_id)
SELECT recipients.user_id,
       'request_handoff',
       'Request sent to Assistant Director Operations',
       '"' || rerouted_requests.title || '" was sent by a Requests Operator for your review.',
       rerouted_requests.id
FROM rerouted_requests
CROSS JOIN LATERAL (
  SELECT p.id AS user_id
  FROM public.profiles p
  WHERE p.organization_id = rerouted_requests.organization_id
    AND p.role = 'assistant_director_operations'
  UNION
  SELECT rerouted_requests.workflow_owner_id
  WHERE rerouted_requests.workflow_owner_id IS NOT NULL
) recipients;
