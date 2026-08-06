import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, normalizeUuid, isValidUuid, writeAudit, writeNotifications } from '@/lib/supabase/serverHelpers';

const OPERATIONS_ELIGIBLE_TYPE = 'maintenance_approval';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requestId = normalizeUuid(id);
    if (!isValidUuid(requestId)) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    const body = await req.json();
    const operatorId = normalizeUuid(body?.operatorId);
    const note = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!isValidUuid(operatorId)) {
      return NextResponse.json({ error: 'A valid operatorId is required' }, { status: 400 });
    }

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    // Only super_admin assigns/reassigns an Operational Manager
    if (!ctx?.profile || ctx.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Target must be a real Operational Manager profile
    const { data: operatorProfile, error: operatorError } = await supabase
      .from('profiles')
      .select('id, email, username, role')
      .eq('id', operatorId)
      .maybeSingle();

    if (operatorError || !operatorProfile || operatorProfile.role !== 'operational_manager') {
      return NextResponse.json({ error: 'Selected user is not an Operational Manager' }, { status: 400 });
    }

    // Get request details
    const { data: request, error: fetchError } = await supabase
      .from('requests')
      .select('id, title, organization_id, created_by, status, type, current_stage')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.type !== OPERATIONS_ELIGIBLE_TYPE) {
      return NextResponse.json(
        { error: 'Only maintenance/repair requests are routed through an Operational Manager' },
        { status: 400 }
      );
    }

    const isReassign = request.status === 'in_operation';
    if (!isReassign && request.status !== 'approved') {
      return NextResponse.json(
        { error: 'Request must be approved before it can be assigned to an Operational Manager' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      assigned_operator_id: operatorId,
      assigned_by: ctx.user?.id ?? null,
      assigned_at: nowIso,
      updated_at: nowIso,
    };

    if (!isReassign) {
      updatePayload.status = 'in_operation';
      updatePayload.current_stage = 'assigned';
    }

    const { data: updated, error: updateError } = await supabase
      .from('requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select('*, organizations(name), assigned_operator:profiles!assigned_operator_id(id,email,username)')
      .single();

    if (updateError) {
      return NextResponse.json({ error: (updateError as any)?.message || 'Failed to assign request' }, { status: 500 });
    }

    // Log the assignment/reassignment on the operations timeline
    try {
      await supabase.from('request_operations').insert({
        request_id: requestId,
        stage: isReassign ? (request.current_stage ?? 'assigned') : 'assigned',
        note: note || (isReassign ? 'Reassigned to a new Operational Manager' : 'Assigned to an Operational Manager'),
        actor_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to log request_operations assignment entry:', err);
    }

    // Notify the operator plus whoever submitted the request — not every
    // profile in the org that happens to hold an admin-ish role, just the
    // one actually related to this request — on both first assignment and
    // reassignment, so they always know who currently has it.
    try {
      const orgRecipientIds = isValidUuid(request.created_by) ? [request.created_by as string] : [];

      const rows = [
        {
          user_id: operatorId,
          type: 'assignment',
          title: isReassign ? 'Maintenance request reassigned to you' : 'New maintenance assignment',
          message: `You have been assigned to manage "${request.title}" through to completion.`,
          related_request_id: requestId,
          read: false,
        },
        ...orgRecipientIds
          .filter((userId) => userId !== operatorId)
          .map((userId) => ({
            user_id: userId,
            type: 'status_update',
            title: isReassign ? 'Operational Manager reassigned' : 'Request is now in operation',
            message: isReassign
              ? `Your request "${request.title}" has been reassigned to a new Operational Manager.`
              : `Your request "${request.title}" is now being handled by the operations team.`,
            related_request_id: requestId,
            read: false,
          })),
      ];

      await writeNotifications(supabase, rows);
    } catch (err) {
      console.warn('Failed to create assignment notifications:', err);
    }

    try {
      await writeAudit(supabase, req, {
        action: isReassign ? 'reassigned' : 'assigned',
        table_name: 'requests',
        record_id: requestId,
        old_values: { previous_status: request.status },
        new_values: { status: updatePayload.status ?? request.status, assigned_operator_id: operatorId },
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write audit record for assignment:', err);
    }

    return NextResponse.json({ request: updated }, { status: 200 });
  } catch (err) {
    console.error('Request assignment error', err);
    return NextResponse.json({ error: 'Unable to assign request' }, { status: 500 });
  }
}
