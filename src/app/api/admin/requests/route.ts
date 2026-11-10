import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, writeAudit, writeNotifications, getServiceRoleClient } from '@/lib/supabase/serverHelpers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, requestType, priority, relatedAssetId } = body;

    // Try to get authenticated client from bearer token first, then fall back to cookies
    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile || !ctx.profile.organization_id) {
      console.warn('POST /api/admin/requests - Profile not found or missing organization_id');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (ctx.profile.role === 'custodian') {
      return NextResponse.json({ error: 'Custodians can upload assets but cannot submit requests' }, { status: 403 });
    }

    // Validate inputs
    if (!title?.trim() || !description?.trim() || !requestType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validTypes = ['asset_approval', 'transfer_approval', 'maintenance_approval', 'budget_request', 'general'];
    if (!validTypes.includes(requestType)) {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
      return NextResponse.json({ error: 'Request routing requires SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
    }

    const serviceClient = getServiceRoleClient(supabase);
    const handlerRoles = ['mechanical_request_handler', 'electrical_mechanical_handler'];
    const isRequestHandler = handlerRoles.includes(ctx.profile.role);
    const recipientRoles = isRequestHandler ? ['assistant_director_operations'] : handlerRoles;
    const { data: reviewers, error: reviewersError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('organization_id', ctx.profile.organization_id)
      .in('role', recipientRoles);
    if (reviewersError) {
      console.error('Initial request reviewer lookup failed', reviewersError);
      return NextResponse.json({
        error: isRequestHandler
          ? 'Unable to find Assistant Director Operations'
          : 'Unable to find the Requests Operator team',
      }, { status: 500 });
    }
    if (!reviewers?.length) {
      return NextResponse.json({
        error: isRequestHandler
          ? 'No Assistant Director Operations user is assigned to this organization'
          : 'Ask your Organization Admin to assign a Requests Operator before submitting requests',
      }, { status: 409 });
    }

    // Create request using 'type' column name
    const { data, error } = await supabase
      .from('requests')
      .insert({
        title: title.trim(),
        description: description.trim(),
        type: requestType,
        priority: priority || 'medium',
        related_asset_id: relatedAssetId || null,
        organization_id: ctx.profile.organization_id,
        created_by: ctx.user?.id,
        workflow_owner_id: isRequestHandler ? ctx.user.id : null,
        status: isRequestHandler ? 'escalated' : 'pending',
        workflow_stage: isRequestHandler ? 'assistant_director_operations' : 'mechanical',
      })
      .select()
      .single();

    if (error) {
      console.error('Request creation insert error:', error);
      return NextResponse.json({ error: (error as any)?.message || 'Failed to create request' }, { status: 500 });
    }

    let notificationsSent = true;
    try {
      notificationsSent = await writeNotifications(
        supabase,
        [
          ...reviewers.map((reviewer: { id: string }) => ({
            user_id: reviewer.id,
            type: isRequestHandler ? 'request_handoff' : 'request',
            title: isRequestHandler ? 'New request from Requests Operator' : 'New request received',
            message: isRequestHandler
              ? `The request "${data.title}" was sent to you for Assistant Director Operations review.`
              : `A new request, "${data.title}", is ready for Requests Operator review.`,
            related_request_id: data.id,
          })),
          ...(isRequestHandler ? [{
            user_id: ctx.user.id,
            type: 'request_handoff',
            title: 'Request sent',
            message: `"${data.title}" was sent to Assistant Director Operations for review.`,
            related_request_id: data.id,
          }] : []),
        ]
      );
    } catch (notificationError) {
      notificationsSent = false;
      console.warn('Request notification creation failed', notificationError);
    }

    // Central audit for request creation
    try {
      await writeAudit(supabase, req, {
        action: 'insert',
        table_name: 'requests',
        record_id: data.id,
        old_values: {},
        new_values: data,
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write audit for request creation:', err);
    }

    return NextResponse.json({ request: data, notificationsSent }, { status: 201 });
  } catch (err) {
    console.error('Request creation error', err);
    return NextResponse.json({ error: 'Unable to create request' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const queue = url.searchParams.get('queue');
    const handoffView = url.searchParams.get('view');

    // Try to get authenticated client from bearer token first, then fall back to cookies
    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile) {
      console.warn('GET /api/admin/requests - No profile found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (ctx.profile.role === 'custodian') {
      return NextResponse.json({ error: 'Custodians do not have access to requests' }, { status: 403 });
    }
    if (queue && (queue !== 'agency_admin' || ctx.profile.role !== 'agency_admin')) {
      return NextResponse.json({ error: 'Only Agency Admins can access the receiving queue' }, { status: 403 });
    }

    let query = supabase
      .from('requests')
      .select('*, organizations(name)')
      .order('created_at', { ascending: false });

    // Super admin sees all requests
    if (ctx.profile.role === 'super_admin') {
      if (orgId) {
        query = query.eq('organization_id', orgId);
      }
    } else {
      // Regular users see only their org's requests
      if (!ctx.profile.organization_id) {
        console.warn('GET /api/admin/requests - User has no organization_id in profile');
        return NextResponse.json({ requests: [] });
      }
      query = query.eq('organization_id', ctx.profile.organization_id);
    }

    if (['mechanical_request_handler', 'electrical_mechanical_handler'].includes(ctx.profile.role)) {
      query = query.in('workflow_stage', [
        'mechanical',
        'electrical_mechanical',
        'assistant_director_operations',
        'director_operations',
        'agency_admin',
      ]);
    } else if (ctx.profile.role === 'assistant_director_operations') {
      query = query.in('workflow_stage', ['assistant_director_operations', 'director_operations', 'agency_admin']);
    } else if (ctx.profile.role === 'director_operations') {
      query = query.in('workflow_stage', ['director_operations', 'agency_admin']);
    } else if (queue === 'agency_admin') {
      query = query.eq('workflow_stage', 'agency_admin');
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Request list query error:', error);
      // If it's a query error, still return empty array instead of 500
      return NextResponse.json({ requests: [] });
    }

    const requests = data ?? [];
    if (['mechanical_request_handler', 'electrical_mechanical_handler'].includes(ctx.profile.role)) {
      const downstreamStages = ['assistant_director_operations', 'director_operations', 'agency_admin'];
      const visibleRequests = handoffView === 'sent'
        ? requests.filter((request) =>
            request.workflow_owner_id === ctx.user.id && downstreamStages.includes(request.workflow_stage)
          )
        : handoffView === 'received'
          ? requests.filter((request) =>
              ['mechanical', 'electrical_mechanical'].includes(request.workflow_stage) &&
              request.status === 'pending' &&
              (!request.workflow_owner_id || request.workflow_owner_id === ctx.user.id)
            )
          : requests;
      return NextResponse.json({ requests: visibleRequests });
    }

    return NextResponse.json({ requests });
  } catch (err) {
    console.error('Request list error', err);
    return NextResponse.json({ error: 'Unable to load requests' }, { status: 500 });
  }
}
