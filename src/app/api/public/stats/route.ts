import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';

/**
 * Module-level singleton, not constructed per request. This client holds no
 * per-user session (persistSession/autoRefreshToken are both off) so
 * there's nothing request-specific about it to leak between callers — it's
 * pure config (url + key), safe to build once per server instance and
 * reuse. Building it fresh on every request was previously part of why
 * this route got expensive under concurrent load (see below).
 */
let cachedClient: SupabaseClient | null = null;

/** Row shape of the public_platform_stats() Postgres function (021_public_stats_rpc.sql). */
interface PublicPlatformStatsRow {
  assets_count: number;
  total_asset_value: number;
  organizations_count: number;
  users_count: number;
  requests_count: number;
  pending_requests_count: number;
  inspections_count: number;
}

function getClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Some deployments of this project set SUPABASE_SERVICE_ROLE_KEY, others
  // set the older SUPABASE_SERVICE_KEY (see .env.example /
  // src/lib/supabase/serverHelpers.ts, which already checks both).
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRoleKey || anonKey;

  if (!supabaseUrl || !key) return null;

  cachedClient = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/**
 * Unauthenticated, read-only aggregate counts for the marketing landing
 * page's "Operations Overview" panel. Only ever returns counts/sums — never
 * row-level data — so it's safe to expose without a session.
 *
 * Used to run 7 separate queries in parallel (one of them an unbounded
 * `select('purchase_value')` over every asset row, summed in JS) against a
 * freshly-constructed client every request. Load-testing this route found
 * that collapsing to a fast-reject 429 under load was the only thing
 * keeping it fast — real concurrent traffic (many distinct callers, so the
 * per-identifier rate limit doesn't kick in) meant up to 7x as many
 * simultaneous outbound connections to Supabase as incoming requests,
 * which took response times from ~100ms to 5-16+ seconds at just 30
 * concurrent requests. Replaced with one round-trip to a Postgres function
 * (021_public_stats_rpc.sql) that computes every aggregate server-side —
 * same SECURITY DEFINER "counts/sums only, bypass RLS for exactly that"
 * guarantee the service-role key gave before, just explicit in the
 * function instead of incidental to which key happened to be configured.
 */
export async function GET(req: Request) {
  try {
    const identifier = getClientIdentifier(req);
    const rate = await checkRateLimit('read', identifier);
    if (!rate.success) {
      return rateLimitResponse(rate);
    }

    const supabase = getClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const { data, error } = await supabase.rpc('public_platform_stats').single<PublicPlatformStatsRow>();
    if (error || !data) {
      console.error('Public stats RPC error', error);
      return NextResponse.json({ error: 'Unable to load platform stats' }, { status: 500 });
    }

    return NextResponse.json(
      {
        stats: {
          assetsCount: data.assets_count ?? 0,
          totalAssetValue: data.total_asset_value ?? 0,
          organizationsCount: data.organizations_count ?? 0,
          usersCount: data.users_count ?? 0,
          requestsCount: data.requests_count ?? 0,
          pendingRequestsCount: data.pending_requests_count ?? 0,
          inspectionsCount: data.inspections_count ?? 0,
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
