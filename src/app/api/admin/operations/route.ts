import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, isValidUuid } from '@/lib/supabase/serverHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const operatorId = url.searchParams.get('operatorId');

    let supabase = getSupabaseFromRequest(req);
    if (!supabase) {
      supabase = await createServerSideClient();
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const ctx = await getProfile(supabase, req);

    if (!ctx?.profile || !['operational_manager', 'super_admin'].includes(ctx.profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let query = supabase
      .from('requests')
      .select('*, organizations(name), assigned_operator:profiles!assigned_operator_id(id,email,username)')
      .not('assigned_operator_id', 'is', null)
      .order('assigned_at', { ascending: false });

    if (ctx.profile.role === 'operational_manager') {
      // Operators only ever see their own assigned requests — operatorId is
      // ignored for them so they can't query anyone else's queue.
      query = query.eq('assigned_operator_id', ctx.user?.id ?? '');
    } else if (operatorId && isValidUuid(operatorId)) {
      query = query.eq('assigned_operator_id', operatorId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Operations list query error:', error);
      return NextResponse.json({ requests: [] });
    }

    return NextResponse.json({ requests: data ?? [] });
  } catch (err) {
    console.error('Operations list error', err);
    return NextResponse.json({ error: 'Unable to load operations' }, { status: 500 });
  }
}
