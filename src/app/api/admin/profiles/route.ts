import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, writeAudit } from '@/lib/supabase/serverHelpers';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: Request) {
  try {
    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile || ctx.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Reads as the service role once we've confirmed the caller is super_admin,
    // so the listing isn't at the mercy of cookie/RLS propagation for this request.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const reader = serviceRoleKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : supabase;

    const { data: profiles, error } = await reader
      .from('profiles')
      .select('id, email, username, role, organization_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profiles: profiles ?? [] });
  } catch (error) {
    console.error('Profiles fetch failed', error);
    return NextResponse.json({ error: 'Unable to load profiles' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile || ctx.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Creates a new auth user — same "sensitive, mint-something-new" class
    // of action as organization creation and password resets.
    const rateLimit = await checkRateLimit('auth-sensitive', ctx.user.id);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceRoleKey) {
      console.error('Supabase service role key is missing for profile creation');
      return NextResponse.json({ error: 'Creating users requires SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }

    const email = body.email?.toString().trim();
    const password = body.password?.toString();
    const requestedRole = body.role || 'ministry_admin';
    const dbRole = requestedRole === 'department_admin' ? 'department_head' : requestedRole;
    const organizationId = body.organization_id || null;
    const username = body.username?.toString().trim() || null;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'A password of at least 8 characters is required' }, { status: 400 });
    }
    // super_admin and operational_manager are identified by username
    // throughout the UI instead of email — enforced here, not just in the
    // form, since the API is the actual source of truth.
    if ((dbRole === 'super_admin' || dbRole === 'operational_manager') && !username) {
      return NextResponse.json({ error: 'A username is required for this role' }, { status: 400 });
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Create the underlying auth user first — profiles.id has no default and
    // must reference a real auth.users id, so a profile row can't exist
    // without one to begin with.
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: dbRole },
    });

    if (userError) {
      console.error('Supabase auth createUser error', userError);
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    const newUserId = userData?.user?.id;
    if (!newUserId) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .insert([{ id: newUserId, email, username, role: dbRole, organization_id: organizationId }])
      .select('*')
      .single();

    if (error) {
      // Roll back the orphaned auth user if the profile row couldn't be created
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      const message = (error as any)?.code === '23505' ? 'That username is already taken' : error.message;
      return NextResponse.json({ error: message }, { status: (error as any)?.code === '23505' ? 409 : 500 });
    }

    try {
      await writeAudit(supabaseAdmin, req, {
        action: 'insert',
        table_name: 'profiles',
        record_id: profile.id,
        old_values: {},
        new_values: profile,
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write audit for profile creation:', err);
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Profile create failed', error);
    return NextResponse.json({ error: 'Unable to create profile' }, { status: 500 });
  }
}
