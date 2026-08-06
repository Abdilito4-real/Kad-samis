import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, writeAudit } from '@/lib/supabase/serverHelpers';

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const requestSupabase = getSupabaseFromRequest(req);
    const supabase = requestSupabase ?? (await createServerSideClient());
    const ctx = await getProfile(supabase, req);
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (ctx.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!serviceRoleKey) {
      console.error('Supabase service role key is missing for organization creation');
      return NextResponse.json({ error: 'Admin organization creation requires SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Prevent duplicate organizations by name or email
    const { data: existingByName, error: existingByNameError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('name', body.name)
      .limit(1)
      .maybeSingle();

    if (existingByNameError) {
      console.error('Supabase org duplicate name check failed', existingByNameError);
      return NextResponse.json({ error: existingByNameError.message }, { status: 500 });
    }

    if (existingByName) {
      return NextResponse.json({ error: 'Organization already exists', status: 409 }, { status: 409 });
    }

    if (body.email) {
      const { data: existingByEmail, error: existingByEmailError } = await supabase
        .from('organizations')
        .select('id')
        .eq('email', body.email)
        .limit(1)
        .maybeSingle();

      if (existingByEmailError) {
        console.error('Supabase org duplicate email check failed', existingByEmailError);
        return NextResponse.json({ error: existingByEmailError.message }, { status: 500 });
      }

      if (existingByEmail) {
        return NextResponse.json({ error: 'Organization already exists', status: 409 }, { status: 409 });
      }
    }

    // Insert organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert([{ name: body.name, organization_type: body.organization_type, email: body.email, phone: body.phone, address: body.address, logo: body.logo, status: body.status || 'active' }])
      .select('*')
      .single();

    if (orgError) {
      console.error('Supabase org insert error', orgError);
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }

    // Central audit for organization creation
    try {
      await writeAudit(supabaseAdmin, req, {
        action: 'insert',
        table_name: 'organizations',
        record_id: org.id,
        old_values: {},
        new_values: org,
        user_id: ctx.user?.id ?? null,
      });
    } catch (err) {
      console.warn('Failed to write audit for organization creation:', err);
    }

    // Create auth user and profile for admin if provided
    if (body.admin) {
      if (!serviceRoleKey) {
        console.error('Supabase service role key is missing for admin user creation');
        return NextResponse.json({ error: 'Admin user creation requires SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
      }

      const admin = body.admin;
      const requestedRole = admin.role || 'ministry_admin';
      const dbRole = requestedRole === 'department_admin' ? 'department_head' : requestedRole;

      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true,
        user_metadata: {
          full_name: admin.name,
          role: dbRole,
        },
      });

      if (userError) {
        console.error('Supabase auth createUser error', userError);
        return NextResponse.json({ error: userError.message }, { status: 500 });
      }

      const adminId = userData?.user?.id;
      if (!adminId) {
        console.error('Supabase createUser did not return user id', userData);
        return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 });
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert([{ id: adminId, email: admin.email, role: dbRole, organization_id: org.id }])
        .select('*')
        .single();

      if (profileError) {
        console.error('Supabase profile insert error', profileError);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
      // Audit the created admin profile
      try {
        await writeAudit(supabaseAdmin, req, {
          action: 'insert',
          table_name: 'profiles',
          record_id: adminId,
          old_values: {},
          new_values: { id: adminId, email: admin.email, role: dbRole, organization_id: org.id },
          user_id: ctx.user?.id ?? null,
        });
      } catch (err) {
        console.warn('Failed to write audit for admin profile creation:', err);
      }
    }

    return NextResponse.json({ organization: org });
  } catch (err) {
    console.error('Supabase create organization failed', err);
    return NextResponse.json({ error: 'Unable to create organization' }, { status: 500 });
  }

  return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
}
