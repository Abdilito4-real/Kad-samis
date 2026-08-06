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

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    // Only super_admin can approve requests
    if (!ctx?.profile || ctx.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get request details to notify the organization
    const { data: request, error: fetchError } = await supabase
      .from('requests')
      .select('id, title, organization_id, created_by, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only allow approving pending or escalated requests
    if (!['pending', 'escalated'].includes((request as any).status)) {
      return NextResponse.json({ error: `Cannot approve a ${ (request as any).status } request` }, { status: 400 });
    }

    // Was `if (request.organization_id && request.organization_id.trim())` —
    // that only catches empty strings, not a non-empty value that still
    // isn't a valid UUID. isValidUuid is the same helper already used above
    // for requestId, applied consistently here too.
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
      console.warn('approve request missing organization_id for request', id);
    }

    // Update request status to approved
    const { data: updated, error: updateError } = await supabase
      .from('requests')
      .update({
        status: 'approved',
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: (updateError as any)?.message || 'Failed to update request' }, { status: 500 });
    }

    // Create notification for the organization user
    const notificationMessage = `Your request "${request.title}" has been approved`;
    const notificationType = 'approval';

    try {
      // normalizeUuid only strips whitespace and rejects empty strings — it
      // does NOT confirm the result is a real UUID. A non-empty-but-invalid
      // value (e.g. corrupted data) would previously reach this insert and
      // throw the same "invalid input syntax for type uuid" error. Filtering
      // with isValidUuid closes that gap.
      const recipientIds = Array.from(new Set([
        normalizeUuid(request.created_by),
        ...(organizationAdmins ?? []).map((admin: { id: string }) => normalizeUuid(admin.id)),
      ].filter((recipientId): recipientId is string => isValidUuid(recipientId))));

      if (recipientIds.length > 0) {
        await writeNotifications(
          supabase,
          recipientIds.map((userId) => ({
            user_id: userId,
            type: notificationType,
            title: `Request Approved`,
            message: notificationMessage,
            related_request_id: requestId,
          }))
        );
      }
    } catch (err: any) {
      console.warn('Failed to create notification:', err);
      // Don't fail the approval if notification creation fails
    }

    // Write richer audit record (service role preferred inside helper)
    try {
      await writeAudit(supabase, req, {
        action: 'approved',
        table_name: 'requests',
        record_id: requestId,
        old_values: { previous_status: request.status },
        new_values: { status: 'approved' },
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write audit record for approval:', err);
    }

    return NextResponse.json({ request: updated }, { status: 200 });
  } catch (err) {
    console.error('Request approval error', err);
    return NextResponse.json({ error: 'Unable to process request' }, { status: 500 });
  }
}