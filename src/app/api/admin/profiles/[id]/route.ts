import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, isValidUuid, writeAudit } from '@/lib/supabase/serverHelpers';

// Fields callers are allowed to change here. Kept to an explicit allowlist
// rather than spreading the raw request body straight into the update —
// this route previously had no auth check at all and accepted anything,
// including a `role` change, which any unauthenticated caller could use to
// hand themselves super_admin.
const EDITABLE_FIELDS = ['username', 'email', 'role', 'organization_id'] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid profile ID' }, { status: 400 });
    }

    const body = await req.json();

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    const isOrganizationAdmin = ['agency_admin', 'ministry_admin', 'department_head'].includes(ctx?.profile?.role ?? '');
    const isSelf = ctx?.user?.id === id;
    if (!ctx?.profile || (ctx.profile.role !== 'super_admin' && !isSelf && !(isOrganizationAdmin && 'role' in body))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (isOrganizationAdmin && 'role' in body) {
      const organizationRoles = [
        'agency_admin',
        'mechanical_request_handler',
        'electrical_mechanical_handler',
        'assistant_director_operations',
        'director_operations',
        'custodian',
      ];
      if (!organizationRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Organization admins cannot assign this role' }, { status: 403 });
      }
      if (isSelf) {
        return NextResponse.json({ error: 'You cannot change your own role' }, { status: 403 });
      }
      if (!ctx.profile.organization_id) {
        return NextResponse.json({ error: 'Your profile is not assigned to an organization' }, { status: 403 });
      }

      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
      if (!serviceRoleKey) {
        return NextResponse.json({ error: 'Changing organization user roles requires SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
      }

      const writer = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: existingProfile, error: existingError } = await writer
        .from('profiles')
        .select('id, email, username, role, organization_id')
        .eq('id', id)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 });
      }
      if (!existingProfile || existingProfile.organization_id !== ctx.profile.organization_id) {
        return NextResponse.json({ error: 'You can only change roles for users in your organization' }, { status: 403 });
      }

      const { data: profile, error } = await writer
        .from('profiles')
        .update({ role: body.role })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await writeAudit(writer, req, {
        action: 'role_changed',
        table_name: 'profiles',
        record_id: id,
        old_values: existingProfile,
        new_values: profile,
        user_id: ctx.user.id,
      });

      return NextResponse.json({ profile });
    }

    // A non-super-admin editing their own profile can't touch role/org.
    const allowedFields = ctx.profile.role === 'super_admin' ? EDITABLE_FIELDS : (['username'] as const);
    const updatePayload: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updatePayload[field] = body[field];
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
    }

    const { data: existingProfile, error: existingError } = await supabase
      .from('profiles')
      .select('id, email, username, role, organization_id')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (!existingProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (typeof updatePayload.username === 'string') {
      const trimmed = updatePayload.username.trim();
      updatePayload.username = trimmed.length ? trimmed : null;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      const message = (error as any)?.code === '23505' ? 'That username is already taken' : error.message;
      return NextResponse.json({ error: message }, { status: (error as any)?.code === '23505' ? 409 : 500 });
    }

    await writeAudit(supabase, req, {
      action: 'update',
      table_name: 'profiles',
      record_id: id,
      old_values: existingProfile,
      new_values: profile,
      user_id: ctx.user.id,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Profile update failed', error);
    return NextResponse.json({ error: 'Unable to update profile' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid profile ID' }, { status: 400 });
    }

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);
    const isOrganizationAdmin = ['agency_admin', 'ministry_admin', 'department_head'].includes(ctx?.profile?.role ?? '');
    if (!ctx?.profile || (ctx.profile.role !== 'super_admin' && !isOrganizationAdmin)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (ctx.user.id === id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Deleting users requires SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
    }

    const writer = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: target, error: targetError } = await writer
      .from('profiles')
      .select('id, email, username, role, organization_id')
      .eq('id', id)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (isOrganizationAdmin && target.organization_id !== ctx.profile.organization_id) {
      return NextResponse.json({ error: 'You can only delete users in your organization' }, { status: 403 });
    }

    const organizationRoles = [
      'agency_admin',
      'mechanical_request_handler',
      'electrical_mechanical_handler',
      'assistant_director_operations',
      'director_operations',
      'custodian',
    ];
    if (isOrganizationAdmin && !organizationRoles.includes(target.role ?? '')) {
      return NextResponse.json({ error: 'Organization admins cannot delete this role' }, { status: 403 });
    }

    const organizationAdminRoles = ['agency_admin', 'ministry_admin', 'department_head'];
    if (isOrganizationAdmin && organizationAdminRoles.includes(target.role ?? '')) {
      const { count, error: adminCountError } = await writer
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', target.organization_id)
        .in('role', organizationAdminRoles)
        .neq('id', id);

      if (adminCountError) {
        return NextResponse.json({ error: adminCountError.message }, { status: 500 });
      }
      if (count === 0) {
        return NextResponse.json({ error: 'Assign another Organization Admin before deleting this user' }, { status: 409 });
      }
    }

    const auditWritten = await writeAudit(writer, req, {
      action: 'delete',
      table_name: 'profiles',
      record_id: id,
      old_values: target,
      new_values: null,
      user_id: ctx.user.id,
    });
    if (!auditWritten) {
      return NextResponse.json({ error: 'Unable to record the user deletion' }, { status: 500 });
    }

    const { error: deleteError } = await writer.auth.admin.deleteUser(id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile deletion failed', error);
    return NextResponse.json({ error: 'Unable to delete user' }, { status: 500 });
  }
}
