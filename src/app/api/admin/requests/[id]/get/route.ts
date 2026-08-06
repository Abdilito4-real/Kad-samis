import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest } from '@/lib/supabase/serverHelpers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get request details
    const { data: request, error: fetchError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check permissions: super admin can see all, org admin can see their own org
    if (ctx.profile.role !== 'super_admin' && request.organization_id !== ctx.profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ request }, { status: 200 });
  } catch (err) {
    console.error('Request fetch error', err);
    return NextResponse.json({ error: 'Unable to fetch request' }, { status: 500 });
  }
}
