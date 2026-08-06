import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

async function getProfile(supabase: any, req?: Request) {
  const authHeader = req?.headers.get('authorization');
  const accessToken = authHeader?.replace(/^Bearer\s+/i, '').trim();

  let user = null;
  let profileClient = supabase;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (accessToken && supabaseUrl && anonKey) {
    const tokenClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: tokenUserData, error: tokenUserError } = await tokenClient.auth.getUser(accessToken);

    if (!tokenUserError && tokenUserData?.user) {
      user = tokenUserData.user;
      if (serviceRoleKey) {
        profileClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
      } else {
        profileClient = tokenClient;
      }
    } else {
      console.warn('Token-based user lookup failed', tokenUserError?.message);
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

  return { user, profile };
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSideClient();

    const ctx = await getProfile(supabase, req);

    const debug = {
      timestamp: new Date().toISOString(),
      hasUser: !!ctx?.user,
      userId: ctx?.user?.id || null,
      userEmail: ctx?.user?.email || null,
      hasProfile: !!ctx?.profile,
      profileId: ctx?.profile?.id || null,
      organizationId: ctx?.profile?.organization_id || null,
      role: ctx?.profile?.role || null,
      hasAuthHeader: !!req.headers.get('authorization'),
      cookieCount: (req.headers.get('cookie') || '').split(';').length,
    };

    if (!ctx?.user) {
      return NextResponse.json({ ...debug, error: 'No authenticated user' }, { status: 401 });
    }

    if (!ctx?.profile) {
      return NextResponse.json({ ...debug, error: 'User has no profile' }, { status: 403 });
    }

    // Test asset fetch
    const { data: assets, error: assetError } = await supabase
      .from('assets')
      .select('id, organization_id, name')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      ...debug,
      assetsFetchStatus: assetError ? 'error' : 'success',
      assetsFetchError: assetError?.message || null,
      assetsCount: assets?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Debug failed' }, { status: 500 });
  }
}
