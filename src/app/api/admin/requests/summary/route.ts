import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { getProfile, getSupabaseFromRequest, isValidUuid } from '@/lib/supabase/serverHelpers';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawOrgId = url.searchParams.get('orgId');
    // Anything that isn't an actual UUID (empty string, "null", garbage)
    // is treated as "no org filter requested" instead of being handed
    // straight to Postgres, which throws `invalid input syntax for type
    // uuid` and previously took the whole route down with it.
    const orgId = rawOrgId && isValidUuid(rawOrgId) ? rawOrgId : null;

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

    // Same validation applied to the caller's own organization_id — a
    // profile with a malformed or empty-string value here (rather than a
    // proper NULL) previously reached Postgres unfiltered too.
    const callerOrgId = ctx.profile.organization_id && isValidUuid(ctx.profile.organization_id)
      ? ctx.profile.organization_id
      : null;

    const applyOrgFilter = (query: any) => {
      if (ctx.profile.role !== 'super_admin' && callerOrgId) {
        return query.eq('organization_id', callerOrgId);
      }
      if (ctx.profile.role === 'super_admin' && orgId) {
        return query.eq('organization_id', orgId);
      }
      return query;
    };

    // Run all three counts in parallel and check every one of them for
    // errors — previously only the `total` query's error was checked;
    // `pending` and `escalated` failures were silently discarded and would
    // just render as "0", hiding real problems (like this one) instead of
    // surfacing them.
    const [totalRes, pendingRes, escalatedRes] = await Promise.all([
      applyOrgFilter(supabase.from('requests').select('id', { count: 'exact', head: true })),
      applyOrgFilter(supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
      applyOrgFilter(supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'escalated')),
    ]);

    const queryError = totalRes.error || pendingRes.error || escalatedRes.error;
    if (queryError) {
      console.error('Request summary query error', queryError);
      return NextResponse.json({ pending: 0, escalated: 0, total: 0 });
    }

    return NextResponse.json({
      total: totalRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      escalated: escalatedRes.count ?? 0,
    });
  } catch (err) {
    console.error('Request summary error', err);
    return NextResponse.json({ pending: 0, escalated: 0, total: 0 });
  }
}