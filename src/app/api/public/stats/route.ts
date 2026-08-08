import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';

/**
 * Unauthenticated, read-only aggregate counts for the marketing landing
 * page's "Operations Overview" panel. Only ever returns counts/sums — never
 * row-level data — so it's safe to expose without a session. Uses the
 * service role key (falling back to the anon key) so the numbers reflect
 * the whole platform rather than whatever RLS would allow an anonymous
 * caller to see directly.
 */
export async function GET(req: Request) {
  try {
    const identifier = getClientIdentifier(req);
    const rate = await checkRateLimit('read', identifier);
    if (!rate.success) {
      return rateLimitResponse(rate);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Some deployments of this project set SUPABASE_SERVICE_ROLE_KEY,
    // others set the older SUPABASE_SERVICE_KEY (see .env.example /
    // src/lib/supabase/serverHelpers.ts, which already checks both) —
    // checking only the first name silently fell back to the anon key here,
    // and RLS blocks anonymous reads on these tables, so every count came
    // back 0 even with real data in the database.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const key = serviceRoleKey || anonKey;

    if (!supabaseUrl || !key) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [assetsRes, valueRes, organizationsRes, profilesRes, requestsRes, pendingRequestsRes, inspectionsRes] = await Promise.all([
      supabase.from('assets').select('id', { count: 'exact', head: true }),
      supabase.from('assets').select('purchase_value'),
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('requests').select('id', { count: 'exact', head: true }),
      supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('inspections').select('id', { count: 'exact', head: true }),
    ]);

    const totalAssetValue = (valueRes.data ?? []).reduce(
      (sum: number, row: { purchase_value: number | null }) => sum + (row.purchase_value ?? 0),
      0
    );

    return NextResponse.json(
      {
        stats: {
          assetsCount: assetsRes.count ?? 0,
          totalAssetValue,
          organizationsCount: organizationsRes.count ?? 0,
          usersCount: profilesRes.count ?? 0,
          requestsCount: requestsRes.count ?? 0,
          pendingRequestsCount: pendingRequestsRes.count ?? 0,
          inspectionsCount: inspectionsRes.count ?? 0,
        },
      },
      {
        headers: {
          // Public, cacheable for a minute — this is a marketing page, not
          // a live dashboard, and it takes the DB-count load off every
          // landing-page visit.
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Public stats route error', error);
    return NextResponse.json({ error: 'Unable to load platform stats' }, { status: 500 });
  }
}
