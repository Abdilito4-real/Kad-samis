import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, normalizeUuid, isValidUuid, writeAudit } from '@/lib/supabase/serverHelpers';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requestId = normalizeUuid(id);
    if (!isValidUuid(requestId)) {
      return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
    }

    const body = await req.json();
    const { escalationReason, priority } = body;

    // Try to get authenticated client from bearer token first, then fall back to cookies
    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile || (!isValidUuid(ctx.profile.organization_id) && ctx.profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (ctx.profile.role === 'super_admin') {
      return NextResponse.json({ error: 'Super admins approve requests and cannot escalate them' }, { status: 403 });
    }

    // Get request details
    const { data: request, error: fetchError } = await supabase
      .from('requests')
      .select('id, title, organization_id, created_by, status, priority')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only org admin can escalate their own org's requests. Was a
    // string-truthy check — isValidUuid catches malformed values too, not
    // just empty ones.
    if (!isValidUuid(request.organization_id)) {
      console.warn('escalate request missing organization_id for request', id);
      return NextResponse.json({ error: 'Unable to escalate request' }, { status: 500 });
    }

    if (ctx.profile.role !== 'super_admin' && request.organization_id !== ctx.profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized: Can only escalate requests from your organization' }, { status: 403 });
    }

    // Check if request is already escalated
    if (request.status === 'escalated') {
      return NextResponse.json({ error: 'Request is already escalated' }, { status: 400 });
    }

    // Validate priority if provided
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    // Update request status to escalated
    const { data: updated, error: updateError } = await supabase
      .from('requests')
      .update({
        status: 'escalated',
        escalation_reason: escalationReason || null,
        priority: priority || request.priority,
        escalated_at: new Date().toISOString(),
        escalated_by: ctx.user?.id,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: (updateError as any)?.message || 'Failed to escalate request' }, { status: 500 });
    }

    // Create an audit log entry
    try {
      await supabase.from('request_audit_logs').insert({
        request_id: requestId,
        action: 'escalated',
        actor_id: ctx.user?.id,
        timestamp: new Date().toISOString(),
        details: {
          reason: escalationReason,
          previous_status: request.status,
          new_status: 'escalated',
        },
      });
    } catch (err: any) {
      // Log but don't fail if audit log fails
      console.error('Failed to create audit log:', err);
    }

    // Also write to the central audit_logs table using the helper
    try {
      await writeAudit(supabase, req, {
        action: 'escalated',
        table_name: 'requests',
        record_id: requestId,
        old_values: { previous_status: request.status },
        new_values: { status: 'escalated', priority: priority || request.priority },
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write central audit log for escalate:', err);
    }

    return NextResponse.json({ request: updated }, { status: 200 });
  } catch (err) {
    console.error('Request escalation error', err);
    return NextResponse.json({ error: 'Unable to escalate request' }, { status: 500 });
  }
}