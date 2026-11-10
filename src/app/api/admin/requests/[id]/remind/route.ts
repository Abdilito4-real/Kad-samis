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

    const isRequestHandler = ['mechanical_request_handler', 'electrical_mechanical_handler'].includes(ctx.profile.role);
    const reviewerTargets: Record<string, { stage: string; nextRole: string }> = {
      assistant_director_operations: {
        stage: 'assistant_director_operations',
        nextRole: 'director_operations',
      },
      director_operations: {
        stage: 'director_operations',
        nextRole: 'agency_admin',
      },
    };
    const reviewerTarget = reviewerTargets[ctx.profile.role];
    if (!isRequestHandler && !reviewerTarget) {
      return NextResponse.json({ error: 'Only assigned workflow reviewers can send reminders' }, { status: 403 });
    }
    const target = isRequestHandler
      ? { stage: 'assistant_director_operations', nextRole: 'assistant_director_operations' }
      : reviewerTarget;
    if (!target) {
      return NextResponse.json({ error: 'No next workflow reviewer is assigned to this role' }, { status: 403 });
    }
    if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
      return NextResponse.json({ error: 'Request reminders require SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
    }

    const { data: request, error: requestError } = await supabase
      .from('requests')
      .select('id, title, organization_id, created_by, workflow_owner_id, status, workflow_stage')
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
    if (isRequestHandler && request.workflow_owner_id !== ctx.user.id) {
      return NextResponse.json({ error: 'You can only remind reviewers about requests assigned to you' }, { status: 403 });
    }

    if (request.workflow_stage !== target.stage || request.status !== 'escalated') {
      return NextResponse.json({ error: 'This request is not waiting at the next workflow stage' }, { status: 409 });
    }

    const reader = getServiceRoleClient(supabase);
    let recipientsQuery = reader.from('profiles').select('id').eq('organization_id', request.organization_id);
    recipientsQuery = recipientsQuery.eq('role', target.nextRole);
    const { data: recipients, error: recipientError } = await recipientsQuery;
    if (recipientError) {
      return NextResponse.json({ error: 'Unable to find the next reviewers' }, { status: 500 });
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
      new_values: { workflow_stage: target.stage },
      user_id: ctx.user.id,
    });

    return NextResponse.json({ success: true, notificationsSent });
  } catch (error) {
    console.error('Request reminder failed', error);
    return NextResponse.json({ error: 'Unable to send reminder' }, { status: 500 });
  }
}
