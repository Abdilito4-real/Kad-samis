import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';
import { calculateAssetDepreciation } from '@/lib/depreciation';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgId } = await params;
    const supabase = getSupabaseFromRequest(_req) ?? await createServerSideClient();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, _req);

    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only super_admin can view all orgs, regular admins can only view their own
    if (ctx.profile.role !== 'super_admin' && ctx.profile.organization_id !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get all assets for this organization with category info
    const { data: assets, error: assetError } = await supabase
      .from('assets')
      .select('*, asset_categories(id, name, code, depreciation_rate)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (assetError) {
      console.warn('Asset fetch error:', assetError);
    }

    // Calculate depreciation for each asset
    const assetMetrics = (assets ?? []).map((asset: any) => {
      const category = asset.asset_categories?.[0];
      const depreciationRate = category?.depreciation_rate ?? 10;

      const depreciation = calculateAssetDepreciation(
        asset.purchase_price ?? 0,
        depreciationRate,
        asset.purchase_date ?? new Date().toISOString()
      );

      return {
        id: asset.id,
        assetNumber: asset.asset_number,
        name: asset.name,
        category: category?.name,
        status: asset.status,
        condition: asset.condition,
        ...depreciation,
      };
    });

    // Summary statistics
    const summary = {
      totalAssets: assetMetrics.length,
      totalOriginalValue: assetMetrics.reduce((sum, a) => sum + a.originalValue, 0),
      totalCurrentValue: assetMetrics.reduce((sum, a) => sum + a.currentValue, 0),
      totalAccumulatedDepreciation: assetMetrics.reduce((sum, a) => sum + a.accumulatedDepreciation, 0),
      // Weighted by portfolio value (total depreciation / total original value)
      // rather than a flat average of per-asset percentages, so a handful of
      // small fully-depreciated assets can't skew the headline number.
      depreciationPercentage: (() => {
        const totalOriginal = assetMetrics.reduce((sum, a) => sum + a.originalValue, 0);
        const totalDepreciation = assetMetrics.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);
        return totalOriginal > 0 ? Number(((totalDepreciation / totalOriginal) * 100).toFixed(2)) : 0;
      })(),
      assetsByCondition: {
        excellent: assetMetrics.filter((a) => a.condition === 'excellent').length,
        good: assetMetrics.filter((a) => a.condition === 'good').length,
        fair: assetMetrics.filter((a) => a.condition === 'fair').length,
        poor: assetMetrics.filter((a) => a.condition === 'poor').length,
        damaged: assetMetrics.filter((a) => a.condition === 'damaged').length,
      },
    };

    return NextResponse.json({
      organization: org,
      summary,
      assets: assetMetrics,
    });
  } catch (err) {
    console.error('Organization metrics error', err);
    return NextResponse.json({ error: 'Unable to load organization metrics' }, { status: 500 });
  }
}
