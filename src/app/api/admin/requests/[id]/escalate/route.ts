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
    if (!reason) {
      return NextResponse.json({ error: 'A handoff note is required' }, { status: 400 });
    }

    const supabase = getSupabaseFromRequest(req) ?? await createServerSideClient();
    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile || !ctx.profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const isMechanicalHandler = ctx.profile.role === 'mechanical_request_handler';
    const isElectricalHandler = ctx.profile.role === 'electrical_mechanical_handler';
    if (!isMechanicalHandler && !isElectricalHandler) {
      return NextResponse.json({ error: 'Only request handlers can forward requests' }, { status: 403 });
    }
    if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
      return NextResponse.json({ error: 'Request routing requires SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
    }

    const { data: request, error: fetchError } = await supabase
      .from('requests')
      .select('id, title, organization_id, created_by, status, priority, workflow_stage')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (request.organization_id !== ctx.profile.organization_id) {
      return NextResponse.json({ error: 'You can only forward requests from your organization' }, { status: 403 });
    }

    const expectedStage = isMechanicalHandler ? 'mechanical' : 'electrical_mechanical';
    const validStatus = isMechanicalHandler
      ? request.status === 'pending'
      : request.status === 'escalated';
    const validStage = request.workflow_stage === expectedStage || (isMechanicalHandler && request.workflow_stage === null);
    if (!validStatus || !validStage) {
      return NextResponse.json({ error: 'This request is not awaiting your review' }, { status: 409 });
    }

    if (body.priority && !['low', 'medium', 'high', 'urgent'].includes(body.priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const nextRole = isMechanicalHandler ? 'electrical_mechanical_handler' : 'agency_admin';
    const reader = getServiceRoleClient(supabase);
    const recipientQuery = reader
      .from('profiles')
      .select('id')
      .eq('organization_id', request.organization_id)
      .eq('role', nextRole);
    const { data: recipients, error: recipientsError } = await recipientQuery;
    if (recipientsError) {
      return NextResponse.json({ error: 'Unable to find the next request handlers' }, { status: 500 });
    }
    if (!recipients?.length) {
      return NextResponse.json({
        error: isMechanicalHandler
          ? 'No Electrical & Mechanical Request Handler is assigned to this organization'
          : 'No Agency Admin is assigned to receive this request',
      }, { status: 409 });
    }

    const nextStage = isMechanicalHandler ? 'electrical_mechanical' : 'agency_admin';
    const updatePayload: Record<string, unknown> = {
      workflow_stage: nextStage,
      escalation_reason: reason,
      updated_at: new Date().toISOString(),
    };
    if (isMechanicalHandler) {
      updatePayload.status = 'escalated';
      updatePayload.priority = body.priority || request.priority;
      updatePayload.escalated_at = new Date().toISOString();
      updatePayload.escalated_by = ctx.user.id;
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
    ]);

    const targetLabel = isMechanicalHandler ? 'Electrical & Mechanical Handler' : 'Agency Admin';
    const notificationsSent = await writeNotifications(supabase, Array.from(notifiedIds).map((userId) => ({
      user_id: userId,
      type: 'request_handoff',
      title: 'Request forwarded',
      message: `"${request.title}" was forwarded to the ${targetLabel} for review. Note: ${reason}`,
      related_request_id: id,
    })));

    await writeAudit(supabase, req, {
      action: isMechanicalHandler ? 'forwarded_to_electrical_mechanical' : 'forwarded_to_agency_admin',
      table_name: 'requests',
      record_id: id,
      old_values: { status: request.status, workflow_stage: request.workflow_stage },
      new_values: { status: updated.status, workflow_stage: nextStage },
      user_id: ctx.user.id,
    });

    return NextResponse.json({ request: updated, notificationsSent });
  } catch (error) {
    console.error('Request handoff failed', error);
    return NextResponse.json({ error: 'Unable to forward request' }, { status: 500 });
  }
}
