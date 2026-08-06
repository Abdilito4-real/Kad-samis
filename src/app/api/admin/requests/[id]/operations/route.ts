import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, normalizeUuid, isValidUuid, writeAudit, writeNotifications, getServiceRoleClient } from '@/lib/supabase/serverHelpers';

const STAGE_ORDER = ['assigned', 'monitoring', 'in_progress', 'completed'] as const;
type Stage = (typeof STAGE_ORDER)[number];
const ADVANCEABLE_STAGES: Stage[] = ['monitoring', 'in_progress', 'completed'];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requestId = normalizeUuid(id);
    if (!isValidUuid(requestId)) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    const body = await req.json();
    const stage = body?.stage as Stage;
    const note = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!ADVANCEABLE_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }
    if (!note) {
      return NextResponse.json({ error: 'A note describing this update is required' }, { status: 400 });
    }

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile || ctx.profile.role !== 'operational_manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: request, error: fetchError } = await supabase
      .from('requests')
      .select('id, title, organization_id, created_by, status, current_stage, assigned_operator_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.assigned_operator_id !== ctx.user?.id) {
      return NextResponse.json({ error: 'You are not assigned to this request' }, { status: 403 });
    }

    if (request.status !== 'in_operation') {
      return NextResponse.json({ error: `Cannot update a ${request.status} request` }, { status: 400 });
    }

    const currentIndex = STAGE_ORDER.indexOf((request.current_stage as Stage) ?? 'assigned');
    const nextIndex = STAGE_ORDER.indexOf(stage);
    if (nextIndex <= currentIndex) {
      return NextResponse.json({ error: 'Stage cannot move backward or repeat' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const isCompleting = stage === 'completed';
    const updatePayload: Record<string, unknown> = {
      current_stage: stage,
      updated_at: nowIso,
    };
    if (isCompleting) {
      updatePayload.status = 'completed';
      updatePayload.operation_completed_at = nowIso;
    }

    const { data: updated, error: updateError } = await supabase
      .from('requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select('*, organizations(name), assigned_operator:profiles!assigned_operator_id(id,email,username)')
      .single();

    if (updateError) {
      return NextResponse.json({ error: (updateError as any)?.message || 'Failed to update stage' }, { status: 500 });
    }

    try {
      await supabase.from('request_operations').insert({
        request_id: requestId,
        stage,
        note,
        actor_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to log request_operations stage entry:', err);
    }

    // Every stage transition — not just completion — keeps all three
    // stakeholders in the loop: whoever submitted the request, super_admin,
    // and (implicitly) the operational_manager, who already knows since
    // they're the one making this change and so isn't notified of it.
    // Only the requester is notified on the org side, not every profile in
    // the org that happens to hold an admin-ish role.
    // The caller here is the assigned operational_manager, who — same as an
    // org admin — can only see their own profiles row under RLS, so the
    // super_admin lookup needs the service role or it'd just come back empty.
    try {
      const serviceClient = getServiceRoleClient(supabase);
      const superAdminResult = await serviceClient.from('profiles').select('id').eq('role', 'super_admin');
      const superAdminIds: string[] = (superAdminResult.data ?? []).map((row: { id: string }) => row.id);

      const recipientIds = Array.from(
        new Set(
          [normalizeUuid(request.created_by), ...superAdminIds.map((adminId: string) => normalizeUuid(adminId))].filter(
            (recipientId): recipientId is string => isValidUuid(recipientId)
          )
        )
      );

      const stageLabel = stage.replace('_', ' ');
      if (recipientIds.length) {
        await writeNotifications(
          supabase,
          recipientIds.map((userId) => ({
            user_id: userId,
            type: isCompleting ? 'completion' : 'status_update',
            title: isCompleting ? 'Request completed' : 'Operation update',
            message: isCompleting
              ? `"${request.title}" has been marked complete by the operations team.`
              : `"${request.title}" moved to stage: ${stageLabel}.`,
            related_request_id: requestId,
          }))
        );
      }
    } catch (err) {
      console.warn('Failed to create stage-update notifications:', err);
    }

    try {
      await writeAudit(supabase, req, {
        action: isCompleting ? 'operation_completed' : 'stage_update',
        table_name: 'requests',
        record_id: requestId,
        old_values: { previous_stage: request.current_stage },
        new_values: { stage, status: updatePayload.status ?? request.status },
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write audit record for stage update:', err);
    }

    return NextResponse.json({ request: updated }, { status: 200 });
  } catch (err) {
    console.error('Request stage update error', err);
    return NextResponse.json({ error: 'Unable to update stage' }, { status: 500 });
  }
}
