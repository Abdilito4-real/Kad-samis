import { NextResponse } from 'next/server';
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

    // Only super_admin, or the profile's own owner (e.g. setting their own
    // username), may update a profile.
    if (!ctx?.profile || (ctx.profile.role !== 'super_admin' && ctx.user?.id !== id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
