import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';
import { calculatePortfolioValue } from '@/lib/depreciation';

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseFromRequest(req) ?? await createServerSideClient();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);
    const role = (ctx?.profile?.role as string | undefined) ?? null;

    if (!ctx?.profile || role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized', details: { role, hasProfile: !!ctx?.profile } }, { status: 403 });
    }

    // Fetch all organizations (MDAs)
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, organization_type, created_at')
      .order('created_at', { ascending: false });

    if (orgError) {
      return NextResponse.json({ error: (orgError as any)?.message || 'Failed to load organizations' }, { status: 500 });
    }

    // Fetch all pending requests (avoid related-table select that can fail if FK not set)
    const { data: pendingRequests, error: reqError } = await supabase
      .from('requests')
      .select('id, title, status, created_at, organization_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (reqError) {
      console.warn('Failed to load requests:', reqError);
    }

    // Fetch all assets with categories for portfolio value calculation
    const { data: allAssets, error: assetError } = await supabase
      .from('assets')
      .select('id, asset_number, name, purchase_price, purchase_date, organization_id, category_id, asset_categories(depreciation_rate)');

    if (assetError) {
      console.warn('Failed to load assets:', assetError);
    }

    // Calculate portfolio values
    const assetList = (allAssets ?? []).map((asset: any) => ({
      id: asset.id,
      name: asset.name,
      organizationId: asset.organization_id,
      purchasePrice: asset.purchase_price ?? 0,
      depreciationRate: (asset.asset_categories?.[0]?.depreciation_rate ?? 10) as number,
      purchaseDate: asset.purchase_date ?? new Date().toISOString(),
    }));

    const portfolioMetrics = calculatePortfolioValue(assetList);

    // Fetch super admin stats
    const { data: profilesCount, error: profilesCountError } = await supabase.from('profiles').select('id', { count: 'exact' });
    const { data: requestsCount, error: requestsCountError } = await supabase.from('requests').select('id', { count: 'exact' });
    const { data: maintenanceCount, error: maintenanceCountError } = await supabase
      .from('maintenance_requests')
      .select('id', { count: 'exact' })
      .eq('status', 'pending');

    // Pending maintenance requests joined through their asset to resolve
    // which organization they belong to (maintenance_requests has no
    // organization_id column of its own).
    const { data: pendingMaintenanceByAsset, error: maintenanceByOrgError } = await supabase
      .from('maintenance_requests')
      .select('id, status, assets(organization_id)')
      .eq('status', 'pending');

    if (profilesCountError || requestsCountError || maintenanceCountError || maintenanceByOrgError) {
      console.warn('Dashboard stats lookup warning', { profilesCountError, requestsCountError, maintenanceCountError, maintenanceByOrgError });
    }

    const maintenanceCountByOrg = new Map<string, number>();
    for (const request of pendingMaintenanceByAsset ?? []) {
      const orgId = (request as any)?.assets?.organization_id;
      if (!orgId) continue;
      maintenanceCountByOrg.set(orgId, (maintenanceCountByOrg.get(orgId) ?? 0) + 1);
    }

    // Calculate per-organization metrics
    const orgMetrics = (organizations ?? []).map((org: any) => {
      const orgAssets = assetList.filter((a) => a.organizationId === org.id);
      const orgPortfolio = calculatePortfolioValue(orgAssets);
      const orgPendingRequests = (pendingRequests ?? []).filter((r: any) => r.organization_id === org.id).length;

      return {
        organizationId: org.id,
        organizationName: org.name,
        organizationType: org.organization_type ?? null,
        assetCount: orgAssets.length,
        ...orgPortfolio,
        pendingRequests: orgPendingRequests,
        pendingMaintenance: maintenanceCountByOrg.get(org.id) ?? 0,
      };
    });

    return NextResponse.json({
      dashboard: {
        superAdmin: {
          email: ctx.user?.email,
          organizations: organizations?.length ?? 0,
          totalUsers: profilesCount?.length ?? 0,
          totalRequests: requestsCount?.length ?? 0,
          pendingMaintenanceRequests: maintenanceCount?.length ?? 0,
        },
        portfolio: {
          totalAssets: assetList.length,
          ...portfolioMetrics,
          depreciationPercentage: portfolioMetrics.totalOriginalValue > 0 
            ? ((portfolioMetrics.totalAccumulatedDepreciation / portfolioMetrics.totalOriginalValue) * 100).toFixed(2)
            : 0,
        },
        organizations,
        organizationMetrics: orgMetrics,
        pendingRequests: pendingRequests?.slice(0, 10) ?? [],
      },
    });
  } catch (err) {
    console.error('Super admin dashboard error', err);
    const message = typeof err === 'string' ? err : err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: 'Unable to load dashboard', details: message || 'Unknown error' }, { status: 500 });
  }
}
