import { createServerSideClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Diagnostic endpoint to check organization assignments and asset visibility
 * GET /api/admin/check-user-org
 */
export async function GET() {
  try {
    const supabase = await createServerSideClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    let currentProfile: { id: string; email: string | null; role: string | null; organization_id: string | null } | null = null;

    if (!userError && user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, organization_id')
        .eq('id', user.id)
        .single();

      if (!profileError && profile) {
        currentProfile = profile;
      }
    }

    const serviceRoleClient = getServiceRoleClient();
    const profileClient = serviceRoleClient ?? supabase;

    const { data: profiles, error: profilesError } = await profileClient
      .from('profiles')
      .select('id, email, role, organization_id')
      .order('email', { ascending: true });

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message || 'Failed to load profiles' },
        { status: 500 }
      );
    }

    const { data: organizations, error: orgError } = await profileClient
      .from('organizations')
      .select('id, name');

    if (orgError) {
      return NextResponse.json(
        { error: orgError.message || 'Failed to load organizations' },
        { status: 500 }
      );
    }

    const organizationMap = new Map((organizations ?? []).map((org: { id: string; name: string }) => [org.id, org.name]));

    let organizationAssetCounts: Record<string, number> = {};

    if (serviceRoleClient) {
      const { data: assets, error: assetsError } = await serviceRoleClient.from('assets').select('organization_id');

      if (!assetsError) {
        organizationAssetCounts = (assets ?? []).reduce<Record<string, number>>((acc, asset) => {
          const organizationId = (asset as { organization_id?: string }).organization_id;
          if (!organizationId) return acc;
          acc[organizationId] = (acc[organizationId] ?? 0) + 1;
          return acc;
        }, {});
      }
    }

    const users = (profiles ?? []).map((profile: { id: string; email: string | null; role: string | null; organization_id: string | null }) => {
      const organizationId = profile.organization_id;
      const organizationName = organizationId ? organizationMap.get(organizationId) ?? null : null;
      const assetCount = organizationId ? organizationAssetCounts[organizationId] ?? 0 : 0;
      const canSeeAssets = Boolean(organizationId && assetCount > 0);

      return {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        organizationId,
        organizationName,
        hasOrganization: Boolean(organizationId),
        assetCount,
        canSeeAssets,
        message: !organizationId
          ? '⚠️ No organization assigned.'
          : canSeeAssets
            ? `✅ Can view ${assetCount} asset${assetCount === 1 ? '' : 's'} in ${organizationName ?? 'their organization'}.`
            : '⚠️ Organization assigned but no assets are currently visible for it.',
      };
    });

    return NextResponse.json({
      currentUser: currentProfile
        ? {
            userId: currentProfile.id,
            email: currentProfile.email,
            role: currentProfile.role,
            organizationId: currentProfile.organization_id,
            hasOrganization: !!currentProfile.organization_id,
            message: !currentProfile.organization_id
              ? '⚠️ User missing organization assignment. Assets will not be visible due to RLS policies.'
              : '✅ User properly assigned to organization.',
          }
        : null,
      users,
    });
  } catch (error: any) {
    console.error('Check user org error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to check user organization' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to assign organization to current user
 * POST /api/admin/check-user-org
 * Body: { organizationId: uuid }
 */
import { writeAudit } from '@/lib/supabase/serverHelpers';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSideClient();
    const body = await req.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Update user profile with organization_id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ organization_id: organizationId })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Audit profile organization assignment
    try {
      await writeAudit(supabase, req, {
        action: 'update',
        table_name: 'profiles',
        record_id: user.id,
        old_values: null,
        new_values: { organization_id: organizationId },
        user_id: user.id,
      });
    } catch (err) {
      console.warn('Failed to write audit for profile organization assignment:', err);
    }

    return NextResponse.json({
      success: true,
      message: `User assigned to ${org.name}`,
      userId: user.id,
      organizationId,
      organizationName: org.name,
    });
  } catch (error: any) {
    console.error('Assign organization error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to assign organization' },
      { status: 500 }
    );
  }
}
