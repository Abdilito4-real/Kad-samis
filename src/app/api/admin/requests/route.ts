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
      })
      .select()
      .single();

    if (error) {
      console.error('Request creation insert error:', error);
      return NextResponse.json({ error: (error as any)?.message || 'Failed to create request' }, { status: 500 });
    }

    // Notify every super admin so new requests appear in the review workflow.
    // Both the lookup and the insert are routed through the service role:
    // the caller here is the submitting org admin, who can't see other
    // users' profiles (RLS) to find the super admins in the first place,
    // and couldn't insert notifications for them even if they could.
    try {
      const serviceClient = getServiceRoleClient(supabase);
      const { data: superAdmins } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('role', 'super_admin');

      if (superAdmins?.length) {
        await writeNotifications(
          supabase,
          superAdmins.map((admin: { id: string }) => ({
            user_id: admin.id,
            type: 'request',
            title: 'New request received',
            message: `A new request, "${data.title}", is ready for approval.`,
            related_request_id: data.id,
          }))
        );
      }
    } catch (notificationError) {
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

    return NextResponse.json({ request: data }, { status: 201 });
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
