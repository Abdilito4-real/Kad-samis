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
    const { data: mechanicalHandlers, error: handlersError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('organization_id', ctx.profile.organization_id)
      .eq('role', 'mechanical_request_handler');
    if (handlersError) {
      console.error('Mechanical request handler lookup failed', handlersError);
      return NextResponse.json({ error: 'Unable to find the Mechanical Request Handler' }, { status: 500 });
    }
    if (!mechanicalHandlers?.length) {
      return NextResponse.json({
        error: 'Ask your Organization Admin to assign a Mechanical Request Handler before submitting requests',
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
        status: 'pending',
        workflow_stage: 'mechanical',
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
        mechanicalHandlers.map((handler: { id: string }) => ({
          user_id: handler.id,
          type: 'request',
          title: 'New request received',
          message: `A new request, "${data.title}", is ready for Mechanical Request Handler review.`,
          related_request_id: data.id,
        }))
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

    if (ctx.profile.role === 'mechanical_request_handler') {
      query = query.or('workflow_stage.eq.mechanical,workflow_stage.eq.electrical_mechanical,workflow_stage.eq.agency_admin,workflow_stage.is.null');
    } else if (ctx.profile.role === 'electrical_mechanical_handler') {
      query = query.in('workflow_stage', ['electrical_mechanical', 'agency_admin']);
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

    return NextResponse.json({ requests: data ?? [] });
  } catch (err) {
    console.error('Request list error', err);
    return NextResponse.json({ error: 'Unable to load requests' }, { status: 500 });
  }
}
