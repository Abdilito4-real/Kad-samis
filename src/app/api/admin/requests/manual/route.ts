import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import {
  getProfile,
  getServiceRoleClient,
  getSupabaseFromRequest,
  writeAudit,
  writeNotifications,
} from '@/lib/supabase/serverHelpers';

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const sourceMda = typeof body.sourceMda === 'string' ? body.sourceMda.trim() : '';
    const priority = typeof body.priority === 'string' ? body.priority : 'medium';

    if (!title || title.length > 200 || !description || !sourceMda || sourceMda.length > 200) {
      return NextResponse.json({ error: 'Originating MDA, title, and description are required' }, { status: 400 });
    }
    if (!VALID_PRIORITIES.has(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const supabase = getSupabaseFromRequest(req) ?? await createServerSideClient();
    const ctx = await getProfile(supabase, req);
    if (
      !['mechanical_request_handler', 'electrical_mechanical_handler'].includes(ctx?.profile?.role ?? '') ||
      !ctx?.profile?.organization_id
    ) {
      return NextResponse.json({ error: 'Only Requests Operators can enter manually received MDA requests' }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: 'Manual request routing requires SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
    }

    const serviceClient = getServiceRoleClient(supabase);
    const { data: assistantDirectors, error: assistantDirectorError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('organization_id', ctx.profile.organization_id)
      .eq('role', 'assistant_director_operations');
    if (assistantDirectorError) {
      console.error('Assistant Director Operations lookup failed', assistantDirectorError);
      return NextResponse.json({ error: 'Unable to find Assistant Director Operations' }, { status: 500 });
    }
    if (!assistantDirectors?.length) {
      return NextResponse.json({
        error: 'No Assistant Director Operations user is assigned to this organization',
      }, { status: 409 });
    }

    const { data: request, error: insertError } = await supabase
      .from('requests')
      .insert({
        title,
        description,
        type: 'general',
        priority,
        source_mda: sourceMda,
        organization_id: ctx.profile.organization_id,
        created_by: ctx.user.id,
        workflow_owner_id: ctx.user.id,
        status: 'escalated',
        workflow_stage: 'assistant_director_operations',
        escalation_reason: `Manually received from ${sourceMda}`,
      })
      .select('*, organizations(name)')
      .single();

    if (insertError) {
      console.error('Manual MDA request insert failed', insertError);
      return NextResponse.json({ error: 'Unable to create the manual request' }, { status: 500 });
    }

    const { data: organizationAdmins, error: adminsError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('organization_id', ctx.profile.organization_id)
      .in('role', ['agency_admin', 'ministry_admin', 'department_head']);
    if (adminsError) {
      console.error('Organization admin lookup for manual request failed', adminsError);
    }

    const recipientIds = new Set<string>([
      ...assistantDirectors.map((reviewer: { id: string }) => reviewer.id),
      ...(organizationAdmins ?? []).map((admin: { id: string }) => admin.id),
      ctx.user.id,
    ]);
    const notificationsSent = await writeNotifications(supabase, Array.from(recipientIds).map((userId) => ({
      user_id: userId,
      type: 'request_handoff',
      title: 'New request from Requests Operator',
      message: `"${title}" from ${sourceMda} was sent to you for Assistant Director Operations review.`,
      related_request_id: request.id,
    })));

    await writeAudit(supabase, req, {
      action: 'manual_mda_request_created',
      table_name: 'requests',
      record_id: request.id,
      old_values: {},
      new_values: request,
      user_id: ctx.user.id,
    });

    return NextResponse.json({ request, notificationsSent }, { status: 201 });
  } catch (error) {
    console.error('Manual MDA request creation failed', error);
    return NextResponse.json({ error: 'Unable to create manual request' }, { status: 500 });
  }
}
