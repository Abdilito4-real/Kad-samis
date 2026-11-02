import { NextResponse } from 'next/server';
import { createServerSideClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const CACHE_CONTROL = 'private, no-store';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !(serviceRoleKey || anonKey)) {
      logger.error('asset-categories: Supabase env vars missing');
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });
    }

    const supabase = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : await createServerSideClient();

    const { data, error } = await supabase.from('asset_categories').select('id, name, code').order('name');

    if (error) {
      logger.error('Asset categories fetch failed', error);
      return NextResponse.json({ error: 'Unable to load asset categories' }, { status: 500 });
    }

    return NextResponse.json({ categories: data ?? [] }, { headers: { 'Cache-Control': CACHE_CONTROL } });
  } catch (error) {
    logger.error('Asset categories fetch failed', error);
    return NextResponse.json({ error: 'Unable to load asset categories' }, { status: 500 });
  }
}
