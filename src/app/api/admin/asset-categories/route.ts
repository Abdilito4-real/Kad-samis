import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Asset categories are shared, non-sensitive reference data (see
// 018_asset_categories_rls_select.sql) that changes rarely — a fresh
// category doesn't need to appear instantly everywhere, so this is safe to
// cache. `stale-while-revalidate` means most requests get served instantly
// from cache while a fresh copy is fetched in the background, rather than
// every page load re-querying the table.
const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !(serviceRoleKey || anonKey)) {
      logger.error('asset-categories: Supabase env vars missing');
      return NextResponse.json({ categories: [] });
    }

    const supabase = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : await createServerSideClient();

    const { data, error } = await supabase.from('asset_categories').select('id, name, code').order('name');

    if (error) {
      logger.error('Asset categories fetch failed', error);
      return NextResponse.json({ categories: [] });
    }

    return NextResponse.json({ categories: data ?? [] }, { headers: { 'Cache-Control': CACHE_CONTROL } });
  } catch (error) {
    logger.error('Asset categories fetch failed', error);
    return NextResponse.json({ categories: [] });
  }
}
