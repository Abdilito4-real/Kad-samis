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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    const supabase = getSupabaseFromRequest(req) ?? await createServerSideClient();
    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile || !ctx.profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const isMechanicalHandler = ctx.profile.role === 'mechanical_request_handler';
    const isElectricalHandler = ctx.profile.role === 'electrical_mechanical_handler';
    if (!isMechanicalHandler && !isElectricalHandler) {
      return NextResponse.json({ error: 'Only request handlers can send workflow reminders' }, { status: 403 });
    }
    if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
      return NextResponse.json({ error: 'Request reminders require SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
    }

    const { data: request, error: requestError } = await supabase
      .from('requests')
      .select('id, title, organization_id, created_by, status, workflow_stage')
      .eq('id', id)
      .maybeSingle();
    if (requestError) {
      return NextResponse.json({ error: requestError.message }, { status: 500 });
    }
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (request.organization_id !== ctx.profile.organization_id) {
      return NextResponse.json({ error: 'You can only remind handlers about your organization’s requests' }, { status: 403 });
    }

    const expectedStage = isMechanicalHandler ? 'electrical_mechanical' : 'agency_admin';
    if (request.workflow_stage !== expectedStage || request.status !== 'escalated') {
      return NextResponse.json({ error: 'This request is not waiting at the next workflow stage' }, { status: 409 });
    }

    const reader = getServiceRoleClient(supabase);
    let recipientsQuery = reader.from('profiles').select('id').eq('organization_id', request.organization_id);
    recipientsQuery = recipientsQuery.eq(
      'role',
      isMechanicalHandler ? 'electrical_mechanical_handler' : 'agency_admin'
    );
    const { data: recipients, error: recipientError } = await recipientsQuery;
    if (recipientError) {
      return NextResponse.json({ error: 'Unable to find the next request handlers' }, { status: 500 });
    }
    if (!recipients?.length) {
      return NextResponse.json({ error: 'No handler is available to receive this reminder' }, { status: 409 });
    }

    const recipientIds = new Set<string>([
      ...recipients.map((recipient: { id: string }) => recipient.id),
      ...(request.created_by ? [request.created_by] : []),
    ]);
    const notificationsSent = await writeNotifications(supabase, Array.from(recipientIds).map((userId) => ({
      user_id: userId,
      type: 'request_reminder',
      title: 'Request reminder',
      message: `Reminder: "${request.title}" is awaiting your review.`,
      related_request_id: id,
    })));

    await writeAudit(supabase, req, {
      action: 'workflow_reminder_sent',
      table_name: 'requests',
      record_id: id,
      old_values: null,
      new_values: { workflow_stage: expectedStage },
      user_id: ctx.user.id,
    });

    return NextResponse.json({ success: true, notificationsSent });
  } catch (error) {
    console.error('Request reminder failed', error);
    return NextResponse.json({ error: 'Unable to send reminder' }, { status: 500 });
  }
}
