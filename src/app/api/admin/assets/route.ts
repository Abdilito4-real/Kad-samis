import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { writeAudit } from '@/lib/supabase/serverHelpers';

async function getProfile(supabase: any, req?: Request) {
  const authHeader = req?.headers.get('authorization');
  const accessToken = authHeader?.replace(/^Bearer\s+/i, '').trim();

  let user = null;
  let profileClient = supabase;

  if (accessToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && anonKey) {
      const tokenClient = createClient(supabaseUrl, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      const { data: tokenUserData, error: tokenUserError } = await tokenClient.auth.getUser(accessToken);

      if (!tokenUserError && tokenUserData?.user) {
        user = tokenUserData.user;
        profileClient = tokenClient;
      } else {
        console.warn('Token-based user lookup failed', tokenUserError?.message);
      }
    }
  }

  if (!user) {
    const {
      data: { user: fallbackUser },
      error: authError,
    } = await supabase.auth.getUser();

    user = fallbackUser;
    if (authError) {
      console.warn('Session-based user lookup failed', authError.message);
    }
  }

  if (!user) return null;

  const { data: profile, error: profileError } = await profileClient
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Profile lookup failed', profileError);
    return null;
  }

  return { user, profile, authClient: profileClient };
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSideClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ctx?.profile) {
      console.error('Authenticated user has no profile', { userId: ctx.user.id });
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }

    if (!ctx.profile.organization_id && ctx.profile.role !== 'super_admin') {
      return NextResponse.json(
        {
          error: 'User profile incomplete. Organization assignment required.',
          details: 'organization_id is not set',
        },
        { status: 403 }
      );
    }

    const queryClient = ctx?.authClient ?? supabase;

    let query = queryClient
      .from('assets')
      .select('id, asset_number, name, status, condition, created_at, organization_id')
      .order('created_at', { ascending: false });

    // Only super_admin can see all assets; org admins see only their organization's assets
    if (ctx.profile.role !== 'super_admin' && ctx.profile.organization_id) {
      query = query.eq('organization_id', ctx.profile.organization_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assets: data });
  } catch (error) {
    console.error('Assets fetch failed', error);
    return NextResponse.json({ error: 'Unable to load assets' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await createServerSideClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);
    if (!ctx?.profile) {
      console.error('POST /api/admin/assets unauthorized', {
        authHeader: req.headers.get('authorization'),
        userId: ctx?.user?.id,
        profile: ctx?.profile,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (ctx.profile.role === 'super_admin') {
      return NextResponse.json({ error: 'Super admins have read-only access to assets' }, { status: 403 });
    }

    console.log('POST /api/admin/assets ctx', {
      userId: ctx.user?.id,
      profile: ctx.profile,
      usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      organizationId: ctx.profile.organization_id,
    });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const serviceRoleClient = serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : null;

    const payload = {
      asset_number: body.assetNumber,
      name: body.name,
      category_id: body.categoryId,
      condition: body.condition,
      status: body.status,
      manufacturer: body.manufacturer || null,
      model: body.model || null,
      serial_number: body.serialNumber || null,
      purchase_date: body.purchaseDate || null,
      purchase_price: body.purchasePrice ? Number(body.purchasePrice) : null,
      current_value: body.currentValue ? Number(body.currentValue) : null,
      warranty_expiry: body.warrantyExpiry || null,
      funding_source: body.fundingSource || null,
      notes: body.notes || null,
      organization_id: ctx.profile.role === 'super_admin' ? body.organizationId || ctx.profile.organization_id : ctx.profile.organization_id,
      created_by: ctx.user.id,
    };

    const { data, error } = await (serviceRoleClient ?? supabase)
      .from('assets')
      .insert([payload])
      .select('*');

    if (error) {
      console.error('Asset create failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const createdAsset = data?.[0] ?? { ...payload };

    // Write central audit log for asset creation
    try {
      await writeAudit(serviceRoleClient ?? supabase, req, {
        action: 'insert',
        table_name: 'assets',
        record_id: createdAsset.id ?? null,
        old_values: {},
        new_values: createdAsset,
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write asset creation audit:', err);
    }
    return NextResponse.json({ asset: createdAsset });
  } catch (error) {
    console.error('Asset creation failed', error);
    return NextResponse.json({ error: 'Unable to create asset' }, { status: 500 });
  }
}
