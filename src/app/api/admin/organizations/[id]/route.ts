import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile as getAuthenticatedProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseFromRequest(req) ?? (await createServerSideClient());

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getAuthenticatedProfile(supabase, req);
    if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Include contact fields and the embedded administrator list — the
    // narrower column set here previously left `profiles` (and email/phone/
    // address) undefined on every response, so the details page always
    // showed zero administrators regardless of what was actually assigned.
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, organization_type, status, email, phone, address, profiles(id, email, role)')
      .eq('id', id);

    if (error) {
      console.error('Organization fetch error:', error);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if organization exists (data will be an empty array if not found)
    if (!data || data.length === 0) {
      console.warn('Organization not found:', id);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const organization = data[0];
    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Organization fetch failed', error);
    return NextResponse.json({ error: 'Unable to fetch organization' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await req.json();
    const { id } = await params;
    const supabase = getSupabaseFromRequest(req) ?? (await createServerSideClient());

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getAuthenticatedProfile(supabase, req);
    if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (ctx.profile.role === 'super_admin') {
      return NextResponse.json({ error: 'Super admins have read-only access to organizations' }, { status: 403 });
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .update(data)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error('Organization update failed', error);
    return NextResponse.json({ error: 'Unable to update organization' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }
    const supabase = getSupabaseFromRequest(req) ?? (await createServerSideClient());

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getAuthenticatedProfile(supabase, req);
    if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (ctx.profile.role === 'super_admin') {
      return NextResponse.json({ error: 'Super admins have read-only access to organizations' }, { status: 403 });
    }

    // Delete in proper order to avoid FK constraint violations
    // 1. Delete requests for this organization
    await supabase
      .from('requests')
      .delete()
      .eq('organization_id', id);

    // 2. Delete assets for this organization
    await supabase
      .from('assets')
      .delete()
      .eq('organization_id', id); 

    // 3. Delete profiles for this organization
    await supabase
      .from('profiles')
      .delete()
      .eq('organization_id', id);

    // 4. Finally delete the organization
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Organization and all related records deleted successfully' });
  } catch (error: any) {
    console.error('Organization delete failed', error);
    return NextResponse.json({ error: error?.message || 'Unable to delete organization' }, { status: 500 });
  }
}
