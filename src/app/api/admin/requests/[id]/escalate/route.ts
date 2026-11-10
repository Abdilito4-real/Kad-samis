import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import {
  getProfile,
  getServiceRoleClient,
  getSupabaseFromRequest,
  isValidUuid,
  writeAudit,
  writeNotifications,
} from '@/lib/supabase/serverHelpers';

const ORGANIZATION_ADMIN_ROLES = ['agency_admin', 'ministry_admin', 'department_head'];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    const body = await req.json();
    const reason = typeof body.escalationReason === 'string' ? body.escalationReason.trim() : '';
    const direction = body.direction ?? 'forward';
    if (direction !== 'forward' && direction !== 'return') {
      return NextResponse.json({ error: 'Invalid handoff direction' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: 'A handoff note is required' }, { status: 400 });
    }

    const supabase = getSupabaseFromRequest(req) ?? await createServerSideClient();
    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile || !ctx.profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const isRequestHandler = ['mechanical_request_handler', 'electrical_mechanical_handler'].includes(ctx.profile.role);
    const isAssistantDirector = ctx.profile.role === 'assistant_director_operations';
    const isDirectorOperations = ctx.profile.role === 'director_operations';
    if (!isRequestHandler && !isAssistantDirector && !isDirectorOperations) {
      return NextResponse.json({ error: 'Only assigned workflow reviewers can hand off requests' }, { status: 403 });
    }
    if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
      return NextResponse.json({ error: 'Request routing requires SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
    }

    const { data: request, error: fetchError } = await supabase
      .from('requests')
      .select('id, title, organization_id, created_by, workflow_owner_id, status, priority, workflow_stage')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (request.organization_id !== ctx.profile.organization_id) {
      return NextResponse.json({ error: 'You can only hand off requests from your organization' }, { status: 403 });
    }
    if (isRequestHandler && request.workflow_owner_id && request.workflow_owner_id !== ctx.user.id) {
      return NextResponse.json({ error: 'You can only hand off requests assigned to you' }, { status: 403 });
    }

    if (direction === 'return' && isRequestHandler) {
      return NextResponse.json({ error: 'Requests Operators cannot return requests to an earlier stage' }, { status: 403 });
    }

    const expectedStage = isRequestHandler
      ? 'mechanical'
      : isAssistantDirector
        ? 'assistant_director_operations'
        : 'director_operations';
    const expectedStatus = isRequestHandler ? 'pending' : 'escalated';
    const validStage = request.workflow_stage === expectedStage || (isRequestHandler && request.workflow_stage === null);
    if (request.status !== expectedStatus || !validStage) {
      return NextResponse.json({ error: 'This request is not awaiting your review' }, { status: 409 });
    }

    if (body.priority && !['low', 'medium', 'high', 'urgent'].includes(body.priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }
    if (direction === 'return' && isAssistantDirector && !request.workflow_owner_id) {
      return NextResponse.json({ error: 'This request has no originating Requests Operator to return to' }, { status: 409 });
    }

    const nextRole = direction === 'return'
      ? isAssistantDirector
        ? 'mechanical_request_handler'
        : 'assistant_director_operations'
      : isRequestHandler
        ? 'assistant_director_operations'
        : isAssistantDirector
          ? 'director_operations'
          : 'agency_admin';
    const reader = getServiceRoleClient(supabase);
    let recipientQuery = reader
      .from('profiles')
      .select('id')
      .eq('organization_id', request.organization_id);
    recipientQuery = direction === 'return' && isAssistantDirector
      ? recipientQuery
          .in('role', ['mechanical_request_handler', 'electrical_mechanical_handler'])
          .eq('id', request.workflow_owner_id)
      : recipientQuery.eq('role', nextRole);
    const { data: recipients, error: recipientsError } = await recipientQuery;
    if (recipientsError) {
      return NextResponse.json({ error: 'Unable to find the next reviewers' }, { status: 500 });
    }
    if (!recipients?.length) {
      return NextResponse.json({
        error: `No ${nextRole.replace(/_/g, ' ')} is assigned to receive this request`,
      }, { status: 409 });
    }

    const nextStage = direction === 'return'
      ? isAssistantDirector
        ? 'mechanical'
        : 'assistant_director_operations'
      : nextRole;
    const updatePayload: Record<string, unknown> = {
      workflow_stage: nextStage,
      status: nextStage === 'mechanical' ? 'pending' : 'escalated',
      escalation_reason: reason,
      escalated_at: new Date().toISOString(),
      escalated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    };
    if (isRequestHandler && direction === 'forward') {
      updatePayload.workflow_owner_id = ctx.user.id;
    }
    if (isRequestHandler) {
      updatePayload.priority = body.priority || request.priority;
    }

    const { data: updated, error: updateError } = await supabase
      .from('requests')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const organizationProfiles = await reader
      .from('profiles')
      .select('id')
      .eq('organization_id', request.organization_id)
      .in('role', ORGANIZATION_ADMIN_ROLES);
    if (organizationProfiles.error) {
      console.error('Request handoff organization user lookup failed', organizationProfiles.error);
    }

    const notifiedIds = new Set<string>([
      ...recipients.map((recipient: { id: string }) => recipient.id),
      ...(organizationProfiles.data ?? []).map((profile: { id: string }) => profile.id),
      ...(request.created_by ? [request.created_by] : []),
      ctx.user.id,
    ]);

    const targetLabels: Record<string, string> = {
      mechanical_request_handler: 'Requests Operators',
      assistant_director_operations: 'Assistant Director Operations',
      director_operations: 'Director Operations',
      agency_admin: 'Director General (Agency Admin)',
    };
    const targetLabel = targetLabels[nextRole];
    const notificationsSent = await writeNotifications(supabase, Array.from(notifiedIds).map((userId) => ({
      user_id: userId,
      type: direction === 'return' ? 'request_returned' : 'request_handoff',
      title: direction === 'return' ? 'Request returned' : 'Request forwarded',
      message: `"${request.title}" was ${direction === 'return' ? 'returned to' : 'forwarded to'} the ${targetLabel} for review. Note: ${reason}`,
      related_request_id: id,
    })));

    await writeAudit(supabase, req, {
      action: `${direction === 'return' ? 'returned_to' : 'forwarded_to'}_${nextRole}`,
      table_name: 'requests',
      record_id: id,
      old_values: { status: request.status, workflow_stage: request.workflow_stage },
      new_values: { status: updated.status, workflow_stage: nextStage, handoff_note: reason },
      user_id: ctx.user.id,
    });

    return NextResponse.json({ request: updated, notificationsSent });
  } catch (error) {
    console.error('Request handoff failed', error);
    return NextResponse.json({ error: 'Unable to hand off request' }, { status: 500 });
  }
}
