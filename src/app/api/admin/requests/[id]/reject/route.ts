import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, normalizeUuid, isValidUuid, writeAudit, writeNotifications } from '@/lib/supabase/serverHelpers';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requestId = normalizeUuid(id);
    if (!isValidUuid(requestId)) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    const body = await req.json();
    const { notes } = body;

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile || ctx.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can reject requests' }, { status: 403 });
    }

    // Get request details
    const { data: request, error: fetchError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Was a truthy/trim check — replaced with isValidUuid for the same
    // reason as the approve route: a non-empty but malformed value would
    // still slip through and fail at query time.
    const requestOrgId = isValidUuid(request.organization_id) ? request.organization_id : null;

    let organizationAdmins: { id: string }[] = [];
    if (requestOrgId) {
      const orgAdminResult = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', requestOrgId)
        .in('role', ['agency_admin', 'ministry_admin', 'department_head']);

      if (orgAdminResult.data) {
        organizationAdmins = orgAdminResult.data as { id: string }[];
      }
    } else {
      console.warn('reject request missing organization_id for request', id);
    }

    // Check if request is in a state that can be rejected
    if (!['pending', 'escalated'].includes(request.status)) {
      return NextResponse.json({ error: `Cannot reject a ${request.status} request` }, { status: 400 });
    }

    // Ensure rejection reason is provided
    if (!notes || !notes.trim()) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    // Update request status to rejected
    const { data: updated, error: updateError } = await supabase
      .from('requests')
      .update({
        status: 'rejected',
        notes: notes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: (updateError as any)?.message || 'Failed to reject request' }, { status: 500 });
    }

    const recipientIds = Array.from(new Set([
      normalizeUuid(request.created_by),
      ...(organizationAdmins ?? []).map((admin) => normalizeUuid(admin.id)),
    ].filter((recipientId): recipientId is string => isValidUuid(recipientId))));

    if (recipientIds.length > 0) {
      await writeNotifications(
        supabase,
        recipientIds.map((userId) => ({
          user_id: userId,
          type: 'rejection',
          title: 'Request Rejected',
          message: `Your request "${request.title}" has been rejected`,
          related_request_id: requestId,
        }))
      );
    }

    // Write audit record for rejection
    try {
      await writeAudit(supabase, req, {
        action: 'rejected',
        table_name: 'requests',
        record_id: requestId,
        old_values: { previous_status: request.status },
        new_values: { status: 'rejected' },
        user_id: ctx?.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write audit for rejection:', err);
    }

    return NextResponse.json({ request: updated }, { status: 200 });
  } catch (err) {
    console.error('Request rejection error', err);
    return NextResponse.json({ error: 'Unable to reject request' }, { status: 500 });
  }
}