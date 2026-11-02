import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');
    const supabase = getSupabaseFromRequest(req) ?? await createServerSideClient();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || !(serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdmin = ctx.profile.role === 'super_admin';
    const organizationId = orgId ?? (isSuperAdmin ? null : ctx.profile.organization_id);

    if (orgId && !isSuperAdmin && ctx.profile.organization_id !== orgId) {
      return NextResponse.json({ error: 'You do not have access to this organization' }, { status: 403 });
    }

    if (!isSuperAdmin && !organizationId) {
      return NextResponse.json({ error: 'Your account has no organization assigned' }, { status: 403 });
    }

    const queryClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : supabase;

    // Organization users are always scoped to their own organization.
    if (organizationId) {
      const [organizationRes, requestsRes, assetsRes] = await Promise.all([
        queryClient
          .from('organizations')
          .select('*, profiles(id,email,role), requests(id,status)')
          .eq('id', organizationId),
        queryClient
          .from('requests')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(8),
        queryClient
          .from('assets')
          .select('id, asset_number, name, status, condition, created_at', { count: 'exact' })
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (organizationRes.error || requestsRes.error || assetsRes.error) {
        console.error(
          'Dashboard organization query error:',
          organizationRes.error || requestsRes.error || assetsRes.error
        );
        return NextResponse.json({ error: 'Failed to load organization dashboard' }, { status: 500 });
      }

      if (!organizationRes.data || organizationRes.data.length === 0) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      const organization = organizationRes.data[0];
      const requests = requestsRes.data ?? [];
      const assets = assetsRes.data ?? [];
      const usersCount = organization.profiles?.length ?? 0;
      const requestsCount = requests.length;
      const pendingRequests = requests.filter((request: any) => request.status === 'pending').length;

      return NextResponse.json({
        summary: {
          organization,
          usersCount,
          requestsCount,
          pendingRequests,
          requests,
          assetsCount: assetsRes.count ?? 0,
          assets,
        },
      });
    }

    const [orgsRes, usersRes, requestsRes, pendingRes, assetsRes] = await Promise.all([
      queryClient.from('organizations').select('id', { count: 'exact' }),
      queryClient.from('profiles').select('id', { count: 'exact' }),
      queryClient.from('requests').select('id', { count: 'exact' }),
      queryClient.from('requests').select('id', { count: 'exact' }).eq('status', 'pending'),
      queryClient.from('assets').select('id, asset_number, name, status, condition, created_at').order('created_at', { ascending: false }).limit(8),
    ]);

    if (orgsRes.error || usersRes.error || requestsRes.error || pendingRes.error || assetsRes.error) {
      console.error('Dashboard summary query error', orgsRes.error || usersRes.error || requestsRes.error || pendingRes.error || assetsRes.error);
      return NextResponse.json({ error: 'Failed to load dashboard summary' }, { status: 500 });
    }

    return NextResponse.json({
      summary: {
        organizations: orgsRes.count ?? 0,
        users: usersRes.count ?? 0,
        requests: requestsRes.count ?? 0,
        pendingRequests: pendingRes.count ?? 0,
        assets: assetsRes.data ?? [],
      },
    });
  } catch (error) {
    console.error('Dashboard summary route error', error);
    return NextResponse.json({ error: 'Unable to load dashboard summary' }, { status: 500 });
  }
}
