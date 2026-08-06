import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');
    const supabase = getSupabaseFromRequest(req) ?? await createServerSideClient();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const queryClient = serviceRoleKey && supabaseUrl
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : supabase;

    if (!supabaseUrl || !(serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    // Get current user profile
    const ctx = await getProfile(supabase);

    // For specific organization view
    if (orgId) {
      const [organizationRes, requestsRes, assetsRes] = await Promise.all([
        queryClient
          .from('organizations')
          .select('*, profiles(id,email,role), requests(id,status)')
          .eq('id', orgId),
        queryClient
          .from('requests')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(8),
        queryClient
          .from('assets')
          .select('id, asset_number, name, status, condition, created_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (organizationRes.error) {
        console.error('Dashboard orgId fetch error:', organizationRes.error);
        // Return empty summary if organization doesn't exist
        return NextResponse.json({
          summary: {
            organization: null,
            usersCount: 0,
            requestsCount: 0,
            pendingRequests: 0,
            requests: [],
            assets: [],
          },
        });
      }

      // Handle case where organization doesn't exist (empty array)
      if (!organizationRes.data || organizationRes.data.length === 0) {
        console.warn('Organization not found:', orgId);
        return NextResponse.json({
          summary: {
            organization: null,
            usersCount: 0,
            requestsCount: 0,
            pendingRequests: 0,
            requests: [],
            assets: [],
          },
        });
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

    // If user is org admin (not super admin) and has organization, return org-specific data
    if (ctx?.profile && ctx.profile.role !== 'super_admin' && ctx.profile.organization_id) {
      const userOrgId = ctx.profile.organization_id;
      
      const [organizationRes, userRequestsRes, userAssetsRes] = await Promise.all([
        queryClient
          .from('organizations')
          .select('*, profiles(id,email,role), requests(id,status)')
          .eq('id', userOrgId),
        queryClient
          .from('requests')
          .select('*')
          .eq('organization_id', userOrgId)
          .order('created_at', { ascending: false })
          .limit(8),
        queryClient
          .from('assets')
          .select('id, asset_number, name, status, condition, created_at, organization_id')
          .eq('organization_id', userOrgId)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (organizationRes.error) {
        console.error('Dashboard org admin fetch error:', organizationRes.error);
        // If organization doesn't exist, return empty summary
        return NextResponse.json({
          summary: {
            organizations: orgsRes.count ?? 0,
            users: usersRes.count ?? 0,
            requests: requestsRes.count ?? 0,
            pendingRequests: pendingRes.count ?? 0,
            assets: [],
          },
        });
      }

      // Handle case where organization doesn't exist (empty array)
      if (!organizationRes.data || organizationRes.data.length === 0) {
        console.warn('Organization not found for org admin:', userOrgId);
        return NextResponse.json({
          summary: {
            organizations: orgsRes.count ?? 0,
            users: usersRes.count ?? 0,
            requests: requestsRes.count ?? 0,
            pendingRequests: pendingRes.count ?? 0,
            assets: [],
          },
        });
      }

      const organization = organizationRes.data[0];
      const userRequests = userRequestsRes.data ?? [];
      const userAssets = userAssetsRes.data ?? [];
      const usersCount = organization.profiles?.length ?? 0;
      const requestsCount = userRequests.length;
      const pendingRequestsCount = userRequests.filter((request: any) => request.status === 'pending').length;

      return NextResponse.json({
        summary: {
          organization,
          usersCount,
          requestsCount: requestsCount,
          pendingRequests: pendingRequestsCount,
          requests: userRequests,
          assets: userAssets,
        },
      });
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
